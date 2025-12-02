-- Fix agent RPC functions to include 'rename' operation type
-- Drop functions first since return types are changing

DROP FUNCTION IF EXISTS public.agent_list_files_by_path_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_read_file_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.agent_read_multiple_files_with_token(uuid[], uuid);
DROP FUNCTION IF EXISTS public.agent_search_files_with_token(uuid, uuid, text);

-- 1. Recreate agent_list_files_by_path_with_token with rename support
CREATE OR REPLACE FUNCTION public.agent_list_files_by_path_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  path text,
  repo_id uuid,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
  WITH staged_changes AS (
    SELECT rs.id as staged_id, rs.file_path, rs.operation_type, rs.old_path
    FROM repo_staging rs
    WHERE rs.repo_id = p_repo_id
  ),
  deleted_paths AS (
    SELECT file_path FROM staged_changes WHERE operation_type = 'delete'
  ),
  renamed_old_paths AS (
    SELECT old_path FROM staged_changes WHERE operation_type = 'rename' AND old_path IS NOT NULL
  )
  -- Committed files (excluding deleted and renamed-from paths)
  SELECT rf.id, rf.path, rf.repo_id, rf.updated_at
  FROM repo_files rf
  WHERE rf.repo_id = p_repo_id
    AND (p_path_prefix IS NULL OR rf.path LIKE p_path_prefix || '%')
    AND rf.path NOT IN (SELECT dp.file_path FROM deleted_paths dp)
    AND rf.path NOT IN (SELECT rop.old_path FROM renamed_old_paths rop WHERE rop.old_path IS NOT NULL)
    AND rf.path NOT IN (
      SELECT sc.file_path FROM staged_changes sc WHERE sc.operation_type = 'edit'
    )
  
  UNION ALL
  
  -- Staged files (add, edit, rename operations)
  SELECT rs.id, rs.file_path as path, rs.repo_id, COALESCE(rs.created_at, now()) as updated_at
  FROM repo_staging rs
  WHERE rs.repo_id = p_repo_id
    AND (p_path_prefix IS NULL OR rs.file_path LIKE p_path_prefix || '%')
    AND rs.operation_type IN ('add', 'edit', 'rename')
  
  ORDER BY path;
END;
$function$;

-- 2. Recreate agent_read_file_with_token with rename support
CREATE OR REPLACE FUNCTION public.agent_read_file_with_token(
  p_file_id uuid,
  p_token uuid
)
RETURNS TABLE (
  id uuid,
  path text,
  content text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
  -- First try staged files (add, edit, rename)
  SELECT rs.id, rs.file_path as path, rs.new_content as content
  FROM repo_staging rs
  WHERE rs.id = p_file_id
    AND rs.operation_type IN ('add', 'edit', 'rename')
    AND rs.new_content IS NOT NULL
  
  UNION ALL
  
  -- Then committed files with staged overlay
  SELECT rf.id, rf.path, COALESCE(rs.new_content, rf.content) as content
  FROM repo_files rf
  LEFT JOIN repo_staging rs ON rs.repo_id = rf.repo_id 
    AND rs.file_path = rf.path 
    AND rs.operation_type IN ('edit', 'rename')
  WHERE rf.id = p_file_id
    AND NOT EXISTS (
      SELECT 1 FROM repo_staging del 
      WHERE del.repo_id = rf.repo_id AND del.file_path = rf.path AND del.operation_type = 'delete'
    )
  
  LIMIT 1;
END;
$function$;

-- 3. Recreate agent_read_multiple_files_with_token with rename support
CREATE OR REPLACE FUNCTION public.agent_read_multiple_files_with_token(
  p_file_ids uuid[],
  p_token uuid
)
RETURNS TABLE (
  id uuid,
  path text,
  content text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
  -- Staged files (add, edit, rename)
  SELECT rs.id, rs.file_path as path, rs.new_content as content
  FROM repo_staging rs
  WHERE rs.id = ANY(p_file_ids)
    AND rs.operation_type IN ('add', 'edit', 'rename')
    AND rs.new_content IS NOT NULL
  
  UNION ALL
  
  -- Committed files with staged overlay
  SELECT rf.id, rf.path, COALESCE(rs.new_content, rf.content) as content
  FROM repo_files rf
  LEFT JOIN repo_staging rs ON rs.repo_id = rf.repo_id 
    AND rs.file_path = rf.path 
    AND rs.operation_type IN ('edit', 'rename')
  WHERE rf.id = ANY(p_file_ids)
    AND NOT EXISTS (
      SELECT 1 FROM repo_staging del 
      WHERE del.repo_id = rf.repo_id AND del.file_path = rf.path AND del.operation_type = 'delete'
    );
END;
$function$;

-- 4. Recreate agent_search_files_with_token with rename support
CREATE OR REPLACE FUNCTION public.agent_search_files_with_token(
  p_project_id uuid,
  p_token uuid,
  p_keyword text
)
RETURNS TABLE (
  id uuid,
  path text,
  content text,
  match_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
  WITH staged_changes AS (
    SELECT rs.id as staged_id, rs.file_path, rs.new_content, rs.operation_type, rs.repo_id
    FROM repo_staging rs
    WHERE rs.project_id = p_project_id
  ),
  deleted_paths AS (
    SELECT file_path, repo_id FROM staged_changes WHERE operation_type = 'delete'
  )
  -- Search committed files (with staged content overlay)
  SELECT rf.id, rf.path, COALESCE(sc.new_content, rf.content) as content,
    CASE WHEN rf.path ILIKE '%' || p_keyword || '%' THEN 'path' ELSE 'content' END as match_type
  FROM repo_files rf
  LEFT JOIN staged_changes sc ON sc.repo_id = rf.repo_id 
    AND sc.file_path = rf.path 
    AND sc.operation_type IN ('edit', 'rename')
  WHERE rf.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1 FROM deleted_paths dp WHERE dp.repo_id = rf.repo_id AND dp.file_path = rf.path
    )
    AND (
      rf.path ILIKE '%' || p_keyword || '%'
      OR COALESCE(sc.new_content, rf.content) ILIKE '%' || p_keyword || '%'
    )
  
  UNION ALL
  
  -- Search staged new files (add and rename operations)
  SELECT rs.id, rs.file_path as path, rs.new_content as content,
    CASE WHEN rs.file_path ILIKE '%' || p_keyword || '%' THEN 'path' ELSE 'content' END as match_type
  FROM repo_staging rs
  WHERE rs.project_id = p_project_id
    AND rs.operation_type IN ('add', 'rename')
    AND rs.new_content IS NOT NULL
    AND (
      rs.file_path ILIKE '%' || p_keyword || '%'
      OR rs.new_content ILIKE '%' || p_keyword || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM repo_files rf WHERE rf.project_id = p_project_id AND rf.path = rs.file_path
    );
END;
$function$;