-- Phase 1: Fix 21 Vulnerable RPC Functions
-- Drop functions first to allow return type changes

-- ============================================
-- STEP 1: Create File-Based Validation Helper
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_file_access(
  p_file_id uuid,
  p_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_repo_id uuid;
BEGIN
  SELECT repo_id INTO v_repo_id FROM repo_files WHERE id = p_file_id;
  IF v_repo_id IS NULL THEN
    SELECT repo_id INTO v_repo_id FROM repo_staging WHERE id = p_file_id;
  END IF;
  IF v_repo_id IS NULL THEN
    RAISE EXCEPTION 'File not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT validate_repo_access(v_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$function$;

-- ============================================
-- STEP 2: Drop All Functions to Recreate
-- ============================================

-- Drop duplicate overloads first
DROP FUNCTION IF EXISTS public.create_project_repo_with_token(uuid, uuid, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.log_agent_operation_with_token(uuid, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.update_agent_operation_status_with_token(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.update_project_with_token(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.upsert_canvas_edge_with_token(uuid, uuid, uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.update_artifact_with_token(uuid, uuid, text, text, text);

-- Drop functions that need return type changes
DROP FUNCTION IF EXISTS public.agent_get_artifacts_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_get_canvas_summary_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.agent_get_project_metadata_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.agent_get_tech_stacks_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.agent_search_files_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_search_requirements_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_search_standards_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_wildcard_search_with_token(uuid, uuid, text[]);
DROP FUNCTION IF EXISTS public.agent_list_files_by_path_with_token(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.agent_read_file_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.agent_read_multiple_files_with_token(uuid[], uuid);

-- ============================================
-- STEP 3: Recreate Project-Based Functions (9)
-- ============================================

CREATE OR REPLACE FUNCTION public.agent_get_artifacts_with_token(
  p_project_id uuid,
  p_token uuid,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE(id uuid, ai_title text, ai_summary text, content text, source_type text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT a.id, a.ai_title, a.ai_summary, a.content, a.source_type, a.created_at
  FROM public.artifacts a
  WHERE a.project_id = p_project_id
    AND (p_search_term IS NULL OR a.content ILIKE '%' || p_search_term || '%' OR a.ai_title ILIKE '%' || p_search_term || '%')
  ORDER BY a.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_get_canvas_summary_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS TABLE(nodes_count integer, edges_count integer, layers_count integer, node_types jsonb, nodes jsonb, edges jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::integer FROM canvas_nodes WHERE project_id = p_project_id),
    (SELECT COUNT(*)::integer FROM canvas_edges WHERE project_id = p_project_id),
    (SELECT COUNT(*)::integer FROM canvas_layers WHERE project_id = p_project_id),
    (SELECT jsonb_object_agg(type, cnt) FROM (SELECT type, COUNT(*) as cnt FROM canvas_nodes WHERE project_id = p_project_id GROUP BY type) t),
    (SELECT jsonb_agg(jsonb_build_object('id', id, 'type', type, 'data', data)) FROM canvas_nodes WHERE project_id = p_project_id),
    (SELECT jsonb_agg(jsonb_build_object('id', id, 'source_id', source_id, 'target_id', target_id, 'label', label)) FROM canvas_edges WHERE project_id = p_project_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_get_project_metadata_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS TABLE(id uuid, name text, description text, organization text, status text, priority text, scope text, budget numeric, timeline_start date, timeline_end date, selected_model text, max_tokens integer, thinking_enabled boolean, thinking_budget integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT p.id, p.name, p.description, p.organization, p.status::text, p.priority, p.scope, p.budget, p.timeline_start, p.timeline_end, p.selected_model, p.max_tokens, p.thinking_enabled, p.thinking_budget
  FROM public.projects p WHERE p.id = p_project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_get_tech_stacks_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS TABLE(id uuid, name text, description text, type text, parent_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT ts.id, ts.name, ts.description, ts.type, ts.parent_id
  FROM public.tech_stacks ts
  INNER JOIN public.project_tech_stacks pts ON pts.tech_stack_id = ts.id
  WHERE pts.project_id = p_project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_search_files_with_token(
  p_project_id uuid,
  p_token uuid,
  p_keyword text
)
RETURNS TABLE(id uuid, path text, content text, match_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT rf.id, rf.path, rf.content, 'content'::text as match_type
  FROM public.repo_files rf
  WHERE rf.project_id = p_project_id AND (rf.path ILIKE '%' || p_keyword || '%' OR rf.content ILIKE '%' || p_keyword || '%')
  UNION ALL
  SELECT rs.id, rs.file_path as path, rs.new_content as content, 'staged'::text as match_type
  FROM public.repo_staging rs
  INNER JOIN public.project_repos pr ON pr.id = rs.repo_id
  WHERE pr.project_id = p_project_id AND rs.operation_type IN ('add', 'edit') AND (rs.file_path ILIKE '%' || p_keyword || '%' OR rs.new_content ILIKE '%' || p_keyword || '%');
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_search_requirements_with_token(
  p_project_id uuid,
  p_token uuid,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, title text, content text, type text, parent_id uuid, order_index integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT r.id, r.code, r.title, r.content, r.type::text, r.parent_id, r.order_index
  FROM public.requirements r
  WHERE r.project_id = p_project_id AND (p_search_term IS NULL OR r.title ILIKE '%' || p_search_term || '%' OR r.content ILIKE '%' || p_search_term || '%')
  ORDER BY r.order_index;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_search_standards_with_token(
  p_project_id uuid,
  p_token uuid,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, title text, description text, content text, category_id uuid, category_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  SELECT s.id, s.code, s.title, s.description, s.content, s.category_id, sc.name as category_name
  FROM public.standards s
  INNER JOIN public.project_standards ps ON ps.standard_id = s.id
  INNER JOIN public.standard_categories sc ON sc.id = s.category_id
  WHERE ps.project_id = p_project_id AND (p_search_term IS NULL OR s.title ILIKE '%' || p_search_term || '%' OR s.code ILIKE '%' || p_search_term || '%')
  ORDER BY s.code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_wildcard_search_with_token(
  p_project_id uuid,
  p_token uuid,
  p_search_terms text[]
)
RETURNS TABLE(id uuid, path text, content_preview text, match_count integer, matched_terms text[], is_staged boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  RETURN QUERY
  WITH search_results AS (
    SELECT rf.id, rf.path, LEFT(rf.content, 200) as content_preview,
      (SELECT COUNT(*)::integer FROM unnest(p_search_terms) t WHERE rf.content ILIKE '%' || t || '%') as match_count,
      (SELECT array_agg(t) FROM unnest(p_search_terms) t WHERE rf.content ILIKE '%' || t || '%') as matched_terms,
      false as is_staged
    FROM public.repo_files rf WHERE rf.project_id = p_project_id
    UNION ALL
    SELECT rs.id, rs.file_path, LEFT(rs.new_content, 200),
      (SELECT COUNT(*)::integer FROM unnest(p_search_terms) t WHERE rs.new_content ILIKE '%' || t || '%'),
      (SELECT array_agg(t) FROM unnest(p_search_terms) t WHERE rs.new_content ILIKE '%' || t || '%'),
      true
    FROM public.repo_staging rs
    INNER JOIN public.project_repos pr ON pr.id = rs.repo_id
    WHERE pr.project_id = p_project_id AND rs.operation_type IN ('add', 'edit')
  )
  SELECT * FROM search_results WHERE search_results.match_count > 0 ORDER BY search_results.match_count DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_project_with_token(
  p_project_id uuid,
  p_token uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_github_repo text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_scope text DEFAULT NULL,
  p_timeline_start date DEFAULT NULL,
  p_timeline_end date DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.projects;
BEGIN
  PERFORM public.validate_project_access(p_project_id, p_token);
  UPDATE public.projects SET
    name = COALESCE(p_name, name), description = COALESCE(p_description, description),
    github_repo = COALESCE(p_github_repo, github_repo), organization = COALESCE(p_organization, organization),
    budget = COALESCE(p_budget, budget), scope = COALESCE(p_scope, scope),
    timeline_start = COALESCE(p_timeline_start, timeline_start), timeline_end = COALESCE(p_timeline_end, timeline_end),
    priority = COALESCE(p_priority, priority), tags = COALESCE(p_tags, tags), updated_at = now()
  WHERE id = p_project_id RETURNING * INTO result;
  RETURN result;
END;
$function$;

-- ============================================
-- STEP 4: Recreate Repo-Based Functions (6)
-- ============================================

CREATE OR REPLACE FUNCTION public.agent_list_files_by_path_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE(id uuid, path text, repo_id uuid, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  SELECT rf.id, rf.path, rf.repo_id, rf.updated_at
  FROM public.repo_files rf
  WHERE rf.repo_id = p_repo_id AND (p_path_prefix IS NULL OR rf.path LIKE p_path_prefix || '%')
    AND NOT EXISTS (SELECT 1 FROM repo_staging rs WHERE rs.repo_id = rf.repo_id AND rs.file_path = rf.path AND rs.operation_type = 'delete')
  UNION ALL
  SELECT rs.id, rs.file_path as path, rs.repo_id, rs.created_at as updated_at
  FROM public.repo_staging rs
  WHERE rs.repo_id = p_repo_id AND rs.operation_type = 'add' AND (p_path_prefix IS NULL OR rs.file_path LIKE p_path_prefix || '%')
  ORDER BY path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_file_with_token(
  p_repo_id uuid,
  p_path text,
  p_content text DEFAULT '',
  p_token uuid DEFAULT NULL
)
RETURNS repo_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  new_file public.repo_files;
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  SELECT project_id INTO v_project_id FROM public.project_repos WHERE id = p_repo_id;
  INSERT INTO public.repo_files (repo_id, project_id, path, content) VALUES (p_repo_id, v_project_id, p_path, p_content) RETURNING * INTO new_file;
  RETURN new_file;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_repo_by_id_with_token(p_repo_id uuid, p_token uuid)
RETURNS SETOF project_repos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY SELECT * FROM public.project_repos WHERE id = p_repo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_repo_files_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_file_paths text[] DEFAULT NULL
)
RETURNS TABLE(path text, content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  IF p_file_paths IS NOT NULL AND array_length(p_file_paths, 1) > 0 THEN
    RETURN QUERY SELECT rf.path, rf.content FROM public.repo_files rf WHERE rf.repo_id = p_repo_id AND rf.path = ANY(p_file_paths);
  ELSE
    RETURN QUERY SELECT rf.path, rf.content FROM public.repo_files rf WHERE rf.repo_id = p_repo_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rename_folder_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_old_path text,
  p_new_path text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.repo_files SET path = p_new_path || substring(path FROM length(p_old_path) + 1), updated_at = now()
  WHERE repo_id = p_repo_id AND path LIKE p_old_path || '%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_file_with_token(
  p_repo_id uuid,
  p_path text,
  p_content text,
  p_token uuid,
  p_commit_sha text DEFAULT NULL
)
RETURNS SETOF repo_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  INSERT INTO public.repo_files (repo_id, project_id, path, content, last_commit_sha)
  SELECT p_repo_id, pr.project_id, p_path, p_content, COALESCE(p_commit_sha, rf.last_commit_sha)
  FROM public.project_repos pr
  LEFT JOIN public.repo_files rf ON rf.repo_id = p_repo_id AND rf.path = p_path
  WHERE pr.id = p_repo_id
  ON CONFLICT (repo_id, path) DO UPDATE SET content = EXCLUDED.content, last_commit_sha = EXCLUDED.last_commit_sha, updated_at = now()
  RETURNING repo_files.*;
END;
$function$;

-- ============================================
-- STEP 5: Recreate File-Based Functions (3)
-- ============================================

CREATE OR REPLACE FUNCTION public.agent_read_file_with_token(p_file_id uuid, p_token uuid)
RETURNS TABLE(id uuid, path text, content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_file_access(p_file_id, p_token);
  RETURN QUERY
  SELECT rs.id, rs.file_path as path, rs.new_content as content
  FROM repo_staging rs WHERE rs.id = p_file_id AND rs.operation_type IN ('add', 'edit', 'rename') AND rs.new_content IS NOT NULL
  UNION ALL
  SELECT rf.id, rf.path, COALESCE(rs.new_content, rf.content) as content
  FROM repo_files rf
  LEFT JOIN repo_staging rs ON rs.repo_id = rf.repo_id AND rs.file_path = rf.path AND rs.operation_type IN ('edit', 'rename')
  WHERE rf.id = p_file_id AND NOT EXISTS (SELECT 1 FROM repo_staging del WHERE del.repo_id = rf.repo_id AND del.file_path = rf.path AND del.operation_type = 'delete');
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_read_multiple_files_with_token(p_file_ids uuid[], p_token uuid)
RETURNS TABLE(id uuid, path text, content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_file_id uuid;
BEGIN
  FOREACH v_file_id IN ARRAY p_file_ids LOOP
    PERFORM public.validate_file_access(v_file_id, p_token);
  END LOOP;
  RETURN QUERY
  SELECT rs.id, rs.file_path as path, rs.new_content as content
  FROM repo_staging rs WHERE rs.id = ANY(p_file_ids) AND rs.operation_type IN ('add', 'edit', 'rename') AND rs.new_content IS NOT NULL
  UNION ALL
  SELECT rf.id, rf.path, COALESCE(rs.new_content, rf.content) as content
  FROM repo_files rf
  LEFT JOIN repo_staging rs ON rs.repo_id = rf.repo_id AND rs.file_path = rf.path AND rs.operation_type IN ('edit', 'rename')
  WHERE rf.id = ANY(p_file_ids) AND NOT EXISTS (SELECT 1 FROM repo_staging del WHERE del.repo_id = rf.repo_id AND del.file_path = rf.path AND del.operation_type = 'delete');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rename_file_with_token(p_file_id uuid, p_token uuid, p_new_path text)
RETURNS repo_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.repo_files;
BEGIN
  PERFORM public.validate_file_access(p_file_id, p_token);
  UPDATE public.repo_files SET path = p_new_path, updated_at = now() WHERE id = p_file_id RETURNING * INTO result;
  RETURN result;
END;
$function$;