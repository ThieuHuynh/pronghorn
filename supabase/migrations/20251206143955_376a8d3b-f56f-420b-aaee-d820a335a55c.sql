-- Phase 2: Eliminate agent_ prefix redundancy
-- Consolidate agent-specific functions into unified versions

-- ============================================
-- 1. Consolidate agent_read_file_with_token into get_file_content_with_token
-- Add support for reading by path (not just file_id)
-- ============================================
DROP FUNCTION IF EXISTS public.agent_read_file_with_token(uuid, text, uuid);

-- Enhanced get_file_content_with_token already exists - keep it as-is
-- Agent uses can use stage_file_change or get_file_content

-- ============================================
-- 2. Consolidate agent_list_files_by_path_with_token into get_repo_files_with_token
-- Add optional path_prefix parameter
-- ============================================
DROP FUNCTION IF EXISTS public.agent_list_files_by_path_with_token(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.get_repo_files_with_token(
  p_repo_id uuid,
  p_token uuid DEFAULT NULL,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  is_binary boolean,
  last_commit_sha text,
  updated_at timestamptz,
  is_staged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
    -- Committed files (excluding those deleted in staging)
    SELECT 
      rf.id,
      rf.path,
      COALESCE(rs.new_content, rf.content) AS content,
      rf.is_binary,
      rf.last_commit_sha,
      rf.updated_at,
      (rs.id IS NOT NULL) AS is_staged
    FROM public.repo_files rf
    LEFT JOIN public.repo_staging rs 
      ON rs.repo_id = rf.repo_id 
      AND rs.file_path = rf.path 
      AND rs.operation_type IN ('edit', 'rename')
    WHERE rf.repo_id = p_repo_id
      AND NOT EXISTS (
        SELECT 1 FROM public.repo_staging del
        WHERE del.repo_id = rf.repo_id 
          AND del.file_path = rf.path 
          AND del.operation_type = 'delete'
      )
      AND (p_path_prefix IS NULL OR rf.path LIKE p_path_prefix || '%')
    
    UNION ALL
    
    -- Newly added files in staging
    SELECT 
      rs.id,
      rs.file_path AS path,
      rs.new_content AS content,
      rs.is_binary,
      NULL AS last_commit_sha,
      rs.created_at AS updated_at,
      true AS is_staged
    FROM public.repo_staging rs
    WHERE rs.repo_id = p_repo_id
      AND rs.operation_type = 'add'
      AND (p_path_prefix IS NULL OR rs.file_path LIKE p_path_prefix || '%')
    
    ORDER BY path;
END;
$function$;

-- ============================================
-- 3. Consolidate agent_get_artifacts_with_token into get_artifacts_with_token
-- Add optional search_term parameter
-- ============================================
DROP FUNCTION IF EXISTS public.agent_get_artifacts_with_token(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.get_artifacts_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS SETOF artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');
  
  RETURN QUERY 
    SELECT * FROM public.artifacts 
    WHERE project_id = p_project_id
      AND (p_search_term IS NULL OR 
           content ILIKE '%' || p_search_term || '%' OR
           ai_title ILIKE '%' || p_search_term || '%' OR
           ai_summary ILIKE '%' || p_search_term || '%')
    ORDER BY created_at DESC;
END;
$function$;

-- ============================================
-- 4. Rename agent_search_files_with_token -> search_file_content_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_search_files_with_token(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.search_file_content_with_token(
  p_repo_id uuid,
  p_search_term text,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  match_count integer,
  is_staged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
    -- Search committed files
    SELECT 
      rf.id,
      rf.path,
      COALESCE(rs.new_content, rf.content) AS content,
      (LENGTH(COALESCE(rs.new_content, rf.content)) - 
       LENGTH(REPLACE(LOWER(COALESCE(rs.new_content, rf.content)), LOWER(p_search_term), ''))) 
       / NULLIF(LENGTH(p_search_term), 0) AS match_count,
      (rs.id IS NOT NULL) AS is_staged
    FROM public.repo_files rf
    LEFT JOIN public.repo_staging rs 
      ON rs.repo_id = rf.repo_id 
      AND rs.file_path = rf.path 
      AND rs.operation_type IN ('edit', 'rename')
    WHERE rf.repo_id = p_repo_id
      AND rf.is_binary = false
      AND (COALESCE(rs.new_content, rf.content) ILIKE '%' || p_search_term || '%'
           OR rf.path ILIKE '%' || p_search_term || '%')
      AND NOT EXISTS (
        SELECT 1 FROM public.repo_staging del
        WHERE del.repo_id = rf.repo_id 
          AND del.file_path = rf.path 
          AND del.operation_type = 'delete'
      )
    
    UNION ALL
    
    -- Search staged new files
    SELECT 
      rs.id,
      rs.file_path AS path,
      rs.new_content AS content,
      (LENGTH(rs.new_content) - LENGTH(REPLACE(LOWER(rs.new_content), LOWER(p_search_term), ''))) 
       / NULLIF(LENGTH(p_search_term), 0) AS match_count,
      true AS is_staged
    FROM public.repo_staging rs
    WHERE rs.repo_id = p_repo_id
      AND rs.operation_type = 'add'
      AND rs.is_binary = false
      AND (rs.new_content ILIKE '%' || p_search_term || '%'
           OR rs.file_path ILIKE '%' || p_search_term || '%')
    
    ORDER BY match_count DESC NULLS LAST, path;
END;
$function$;

-- ============================================
-- 5. Rename agent_wildcard_search_with_token -> wildcard_search_files_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_wildcard_search_with_token(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.wildcard_search_files_with_token(
  p_repo_id uuid,
  p_query text,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  match_count integer,
  matched_terms text[],
  is_staged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_terms text[];
BEGIN
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  PERFORM public.require_role(v_project_id, p_token, 'viewer');
  
  -- Split query into terms
  v_terms := string_to_array(LOWER(p_query), ' ');

  RETURN QUERY
    WITH file_data AS (
      -- Committed files with staging overlay
      SELECT 
        rf.id,
        rf.path,
        COALESCE(rs.new_content, rf.content) AS content,
        rf.is_binary,
        (rs.id IS NOT NULL) AS is_staged
      FROM public.repo_files rf
      LEFT JOIN public.repo_staging rs 
        ON rs.repo_id = rf.repo_id 
        AND rs.file_path = rf.path 
        AND rs.operation_type IN ('edit', 'rename')
      WHERE rf.repo_id = p_repo_id
        AND NOT EXISTS (
          SELECT 1 FROM public.repo_staging del
          WHERE del.repo_id = rf.repo_id 
            AND del.file_path = rf.path 
            AND del.operation_type = 'delete'
        )
      
      UNION ALL
      
      -- Staged new files
      SELECT 
        rs.id,
        rs.file_path AS path,
        rs.new_content AS content,
        rs.is_binary,
        true AS is_staged
      FROM public.repo_staging rs
      WHERE rs.repo_id = p_repo_id
        AND rs.operation_type = 'add'
    ),
    matched_files AS (
      SELECT 
        fd.id,
        fd.path,
        fd.content,
        fd.is_staged,
        array_agg(t) FILTER (WHERE 
          LOWER(fd.content) LIKE '%' || t || '%' OR
          LOWER(fd.path) LIKE '%' || t || '%'
        ) AS matched_terms
      FROM file_data fd
      CROSS JOIN unnest(v_terms) AS t
      WHERE fd.is_binary = false
      GROUP BY fd.id, fd.path, fd.content, fd.is_staged
      HAVING array_length(array_agg(t) FILTER (WHERE 
          LOWER(fd.content) LIKE '%' || t || '%' OR
          LOWER(fd.path) LIKE '%' || t || '%'
        ), 1) > 0
    )
    SELECT 
      mf.id,
      mf.path,
      mf.content,
      array_length(mf.matched_terms, 1) AS match_count,
      mf.matched_terms,
      mf.is_staged
    FROM matched_files mf
    ORDER BY match_count DESC, path;
END;
$function$;

-- ============================================
-- 6. Rename agent_read_multiple_files_with_token -> get_multiple_files_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_read_multiple_files_with_token(uuid, text[], uuid);

CREATE OR REPLACE FUNCTION public.get_multiple_files_with_token(
  p_repo_id uuid,
  p_paths text[],
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  is_binary boolean,
  is_staged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
    -- Committed files with staging overlay
    SELECT 
      rf.id,
      rf.path,
      COALESCE(rs.new_content, rf.content) AS content,
      rf.is_binary,
      (rs.id IS NOT NULL) AS is_staged
    FROM public.repo_files rf
    LEFT JOIN public.repo_staging rs 
      ON rs.repo_id = rf.repo_id 
      AND rs.file_path = rf.path 
      AND rs.operation_type IN ('edit', 'rename')
    WHERE rf.repo_id = p_repo_id
      AND rf.path = ANY(p_paths)
      AND NOT EXISTS (
        SELECT 1 FROM public.repo_staging del
        WHERE del.repo_id = rf.repo_id 
          AND del.file_path = rf.path 
          AND del.operation_type = 'delete'
      )
    
    UNION ALL
    
    -- Staged new files
    SELECT 
      rs.id,
      rs.file_path AS path,
      rs.new_content AS content,
      rs.is_binary,
      true AS is_staged
    FROM public.repo_staging rs
    WHERE rs.repo_id = p_repo_id
      AND rs.file_path = ANY(p_paths)
      AND rs.operation_type = 'add'
    
    ORDER BY path;
END;
$function$;

-- ============================================
-- 7. Rename agent_get_canvas_summary_with_token -> get_canvas_summary_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_get_canvas_summary_with_token(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_canvas_summary_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  total_nodes integer,
  total_edges integer,
  node_types jsonb,
  nodes jsonb,
  edges jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');

  RETURN QUERY
    SELECT 
      (SELECT COUNT(*)::integer FROM public.canvas_nodes WHERE project_id = p_project_id) AS total_nodes,
      (SELECT COUNT(*)::integer FROM public.canvas_edges WHERE project_id = p_project_id) AS total_edges,
      (SELECT jsonb_object_agg(type, cnt) FROM (
        SELECT type::text, COUNT(*) AS cnt 
        FROM public.canvas_nodes 
        WHERE project_id = p_project_id 
        GROUP BY type
      ) t) AS node_types,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', cn.id,
        'type', cn.type,
        'label', cn.data->>'label',
        'description', cn.data->>'description'
      )) FROM public.canvas_nodes cn WHERE cn.project_id = p_project_id) AS nodes,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', ce.id,
        'source', ce.source_id,
        'target', ce.target_id,
        'label', ce.label
      )) FROM public.canvas_edges ce WHERE ce.project_id = p_project_id) AS edges;
END;
$function$;

-- ============================================
-- 8. Rename agent_get_project_metadata_with_token -> get_project_metadata_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_get_project_metadata_with_token(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_project_metadata_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  organization text,
  scope text,
  status project_status,
  priority text,
  budget numeric,
  tags text[],
  github_repo text,
  github_branch text,
  selected_model text,
  max_tokens integer,
  thinking_enabled boolean,
  thinking_budget integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');

  RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.description,
      p.organization,
      p.scope,
      p.status,
      p.priority,
      p.budget,
      p.tags,
      p.github_repo,
      p.github_branch,
      p.selected_model,
      p.max_tokens,
      p.thinking_enabled,
      p.thinking_budget
    FROM public.projects p
    WHERE p.id = p_project_id;
END;
$function$;

-- ============================================
-- 9. Rename agent_get_tech_stacks_with_token -> get_project_tech_stacks_detail_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_get_tech_stacks_with_token(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_project_tech_stacks_detail_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  type text,
  description text,
  icon text,
  color text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');

  RETURN QUERY
    SELECT 
      ts.id,
      ts.name,
      ts.type,
      ts.description,
      ts.icon,
      ts.color,
      ts.metadata
    FROM public.tech_stacks ts
    INNER JOIN public.project_tech_stacks pts ON pts.tech_stack_id = ts.id
    WHERE pts.project_id = p_project_id
    ORDER BY ts.name;
END;
$function$;

-- ============================================
-- 10. Rename agent_search_requirements_with_token -> search_requirements_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_search_requirements_with_token(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.search_requirements_with_token(
  p_project_id uuid,
  p_search_term text,
  p_token uuid DEFAULT NULL
)
RETURNS SETOF requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');

  RETURN QUERY
    SELECT * FROM public.requirements
    WHERE project_id = p_project_id
      AND (title ILIKE '%' || p_search_term || '%'
           OR content ILIKE '%' || p_search_term || '%'
           OR code ILIKE '%' || p_search_term || '%')
    ORDER BY order_index;
END;
$function$;

-- ============================================
-- 11. Rename agent_search_standards_with_token -> search_standards_with_token
-- ============================================
DROP FUNCTION IF EXISTS public.agent_search_standards_with_token(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.search_standards_with_token(
  p_project_id uuid,
  p_search_term text,
  p_token uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  code text,
  title text,
  description text,
  content text,
  category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'viewer');

  RETURN QUERY
    SELECT 
      s.id,
      s.code,
      s.title,
      s.description,
      s.content,
      sc.name AS category_name
    FROM public.standards s
    INNER JOIN public.project_standards ps ON ps.standard_id = s.id
    LEFT JOIN public.standard_categories sc ON sc.id = s.category_id
    WHERE ps.project_id = p_project_id
      AND (s.title ILIKE '%' || p_search_term || '%'
           OR s.description ILIKE '%' || p_search_term || '%'
           OR s.content ILIKE '%' || p_search_term || '%'
           OR s.code ILIKE '%' || p_search_term || '%')
    ORDER BY s.code;
END;
$function$;

-- ============================================
-- 12. Drop agent_create_file_with_token (use stage_file_change_with_token instead)
-- ============================================
DROP FUNCTION IF EXISTS public.agent_create_file_with_token(uuid, text, text, uuid);

-- ============================================
-- 13. Drop agent_edit_lines_with_token (keeping edit_lines_with_token)
-- ============================================
DROP FUNCTION IF EXISTS public.agent_edit_lines_with_token(uuid, text, integer, integer, text, uuid);

-- ============================================
-- 14. Drop agent_delete_file_with_token (use delete_file_with_token)
-- ============================================
DROP FUNCTION IF EXISTS public.agent_delete_file_with_token(uuid, text, uuid);