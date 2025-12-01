-- Comprehensive fix for all agent file RPC functions to handle repo_files + repo_staging overlay

-- 1. Fix agent_list_files_by_path_with_token - exclude staged files from first query to prevent duplicates
CREATE OR REPLACE FUNCTION public.agent_list_files_by_path_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE(
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
  
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  IF p_path_prefix IS NOT NULL THEN
    RETURN QUERY
    -- Committed files NOT in staging at all (no add/edit/delete operations)
    SELECT rf.id, rf.path, rf.repo_id, rf.updated_at
    FROM public.repo_files rf
    WHERE rf.repo_id = p_repo_id
      AND rf.path LIKE p_path_prefix || '%'
      AND NOT EXISTS (
        SELECT 1 FROM repo_staging rs 
        WHERE rs.repo_id = rf.repo_id 
          AND rs.file_path = rf.path
      )
    UNION ALL
    -- Staged files (add or edit), use repo_files.id when it exists
    SELECT 
      COALESCE(rf.id, rs.id) AS id,
      rs.file_path AS path,
      rs.repo_id,
      rs.created_at AS updated_at
    FROM public.repo_staging rs
    LEFT JOIN public.repo_files rf
      ON rf.repo_id = rs.repo_id
     AND rf.path = rs.file_path
    WHERE rs.repo_id = p_repo_id
      AND rs.file_path LIKE p_path_prefix || '%'
      AND rs.operation_type IN ('add', 'edit')
    ORDER BY path ASC;
  ELSE
    RETURN QUERY
    -- Committed files NOT in staging at all
    SELECT rf.id, rf.path, rf.repo_id, rf.updated_at
    FROM public.repo_files rf
    WHERE rf.repo_id = p_repo_id
      AND NOT EXISTS (
        SELECT 1 FROM repo_staging rs 
        WHERE rs.repo_id = rf.repo_id 
          AND rs.file_path = rf.path
      )
    UNION ALL
    -- Staged files (add or edit), use repo_files.id when it exists
    SELECT 
      COALESCE(rf.id, rs.id) AS id,
      rs.file_path AS path,
      rs.repo_id,
      rs.created_at AS updated_at
    FROM public.repo_staging rs
    LEFT JOIN public.repo_files rf
      ON rf.repo_id = rs.repo_id
     AND rf.path = rs.file_path
    WHERE rs.repo_id = p_repo_id
      AND rs.operation_type IN ('add', 'edit')
    ORDER BY path ASC;
  END IF;
END;
$function$;

-- 2. Fix agent_read_file_with_token - return staged content when available
CREATE OR REPLACE FUNCTION public.agent_read_file_with_token(
  p_file_id uuid,
  p_token uuid
)
RETURNS TABLE(
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
  -- Committed files with staging overlay
  SELECT 
    rf.id,
    rf.path,
    COALESCE(rs.new_content, rf.content) AS content
  FROM repo_files rf
  LEFT JOIN repo_staging rs 
    ON rs.repo_id = rf.repo_id 
   AND rs.file_path = rf.path 
   AND rs.operation_type = 'edit'
  WHERE rf.id = p_file_id
    AND validate_repo_access(rf.repo_id, p_token)
  
  UNION ALL
  
  -- Newly created files (only in staging)
  SELECT rs.id, rs.file_path AS path, rs.new_content AS content
  FROM repo_staging rs
  WHERE rs.id = p_file_id
    AND rs.operation_type = 'add'
    AND validate_repo_access(rs.repo_id, p_token);
END;
$function$;

-- 3. Fix agent_read_multiple_files_with_token - apply staging overlay
CREATE OR REPLACE FUNCTION public.agent_read_multiple_files_with_token(
  p_file_ids uuid[],
  p_token uuid
)
RETURNS TABLE(
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
  -- Committed files with staging overlay
  SELECT 
    rf.id,
    rf.path,
    COALESCE(rs.new_content, rf.content) AS content
  FROM repo_files rf
  LEFT JOIN repo_staging rs 
    ON rs.repo_id = rf.repo_id 
   AND rs.file_path = rf.path 
   AND rs.operation_type = 'edit'
  WHERE rf.id = ANY(p_file_ids)
    AND validate_repo_access(rf.repo_id, p_token)
  
  UNION ALL
  
  -- Newly created files (only in staging)
  SELECT rs.id, rs.file_path AS path, rs.new_content AS content
  FROM repo_staging rs
  WHERE rs.id = ANY(p_file_ids)
    AND rs.operation_type = 'add'
    AND validate_repo_access(rs.repo_id, p_token);
END;
$function$;

-- 4. Fix agent_search_files_with_token - search both committed + staged content
CREATE OR REPLACE FUNCTION public.agent_search_files_with_token(
  p_project_id uuid,
  p_token uuid,
  p_keyword text
)
RETURNS TABLE(
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
  
  IF NOT validate_project_access(p_project_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  -- Search committed files with staging overlay (exclude deleted files)
  SELECT 
    rf.id,
    rf.path,
    COALESCE(rs.new_content, rf.content) AS content,
    CASE 
      WHEN rf.path ILIKE '%' || p_keyword || '%' THEN 'path'
      WHEN COALESCE(rs.new_content, rf.content) ILIKE '%' || p_keyword || '%' THEN 'content'
      ELSE 'unknown'
    END AS match_type
  FROM repo_files rf
  LEFT JOIN repo_staging rs 
    ON rs.repo_id = rf.repo_id 
   AND rs.file_path = rf.path 
   AND rs.operation_type = 'edit'
  WHERE rf.project_id = p_project_id
    -- Exclude deleted files
    AND NOT EXISTS (
      SELECT 1 FROM repo_staging rs_del
      WHERE rs_del.repo_id = rf.repo_id
        AND rs_del.file_path = rf.path
        AND rs_del.operation_type = 'delete'
    )
    -- Match keyword in path or content (with staging overlay)
    AND (
      rf.path ILIKE '%' || p_keyword || '%' 
      OR COALESCE(rs.new_content, rf.content) ILIKE '%' || p_keyword || '%'
    )
  
  UNION ALL
  
  -- Search newly created files (only in staging)
  SELECT 
    rs.id,
    rs.file_path AS path,
    rs.new_content AS content,
    CASE 
      WHEN rs.file_path ILIKE '%' || p_keyword || '%' THEN 'path'
      WHEN rs.new_content ILIKE '%' || p_keyword || '%' THEN 'content'
      ELSE 'unknown'
    END AS match_type
  FROM repo_staging rs
  WHERE rs.project_id = p_project_id
    AND rs.operation_type = 'add'
    AND (
      rs.file_path ILIKE '%' || p_keyword || '%'
      OR rs.new_content ILIKE '%' || p_keyword || '%'
    )
  ORDER BY path ASC;
END;
$function$;

-- 5. Fix get_file_content_with_token - return staged content when available
CREATE OR REPLACE FUNCTION public.get_file_content_with_token(
  p_file_id uuid,
  p_token uuid
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  last_commit_sha text,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access via repo
  IF NOT EXISTS (
    SELECT 1 FROM repo_files rf
    WHERE rf.id = p_file_id
    AND validate_repo_access(rf.repo_id, p_token)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  -- Return committed file with staging overlay
  SELECT 
    rf.id, 
    rf.path, 
    COALESCE(rs.new_content, rf.content) AS content,
    rf.last_commit_sha, 
    rf.updated_at
  FROM repo_files rf
  LEFT JOIN repo_staging rs 
    ON rs.repo_id = rf.repo_id 
   AND rs.file_path = rf.path 
   AND rs.operation_type = 'edit'
  WHERE rf.id = p_file_id;
END;
$function$;