-- Phase 1: Remove Exact Duplicates and Merge Functions
-- This migration consolidates duplicate functions into single, unified versions

-- ============================================
-- 1. rename_file_with_token - Drop duplicate with different param order
-- Keep: (p_file_id uuid, p_new_path text, p_token uuid DEFAULT NULL)
-- Drop: (p_file_id uuid, p_token uuid, p_new_path text)
-- ============================================
DROP FUNCTION IF EXISTS public.rename_file_with_token(uuid, uuid, text);

-- ============================================
-- 2. rename_folder_with_token - Drop duplicate with different param order
-- Keep: (p_repo_id, p_old_folder_path, p_new_folder_path, p_token DEFAULT NULL)
-- Drop: (p_repo_id, p_token, p_old_path, p_new_path)
-- ============================================
DROP FUNCTION IF EXISTS public.rename_folder_with_token(uuid, uuid, text, text);

-- ============================================
-- 3. upsert_file_with_token - Drop both and recreate unified version
-- ============================================
DROP FUNCTION IF EXISTS public.upsert_file_with_token(uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.upsert_file_with_token(uuid, text, text, uuid, boolean);

CREATE OR REPLACE FUNCTION public.upsert_file_with_token(
  p_repo_id uuid,
  p_path text,
  p_content text,
  p_token uuid DEFAULT NULL,
  p_is_binary boolean DEFAULT false,
  p_commit_sha text DEFAULT NULL
)
RETURNS repo_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.repo_files;
BEGIN
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  PERFORM public.require_role(v_project_id, p_token, 'editor');

  INSERT INTO public.repo_files (repo_id, project_id, path, content, is_binary, last_commit_sha)
  VALUES (p_repo_id, v_project_id, p_path, p_content, p_is_binary, p_commit_sha)
  ON CONFLICT (repo_id, path) DO UPDATE SET
    content = EXCLUDED.content,
    is_binary = EXCLUDED.is_binary,
    last_commit_sha = COALESCE(EXCLUDED.last_commit_sha, repo_files.last_commit_sha),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- ============================================
-- 4. update_project_with_token - Drop both and recreate unified version with ALL fields
-- ============================================
DROP FUNCTION IF EXISTS public.update_project_with_token(uuid, uuid, text, text, text, text, numeric, text, date, date, text, text[]);
DROP FUNCTION IF EXISTS public.update_project_with_token(uuid, uuid, text, text, text, text, numeric, text, date, date, public.project_status, text);

CREATE OR REPLACE FUNCTION public.update_project_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_scope text DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_status project_status DEFAULT NULL,
  p_github_repo text DEFAULT NULL,
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
  PERFORM public.require_role(p_project_id, p_token, 'editor');

  UPDATE public.projects
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    organization = COALESCE(p_organization, organization),
    scope = COALESCE(p_scope, scope),
    budget = COALESCE(p_budget, budget),
    priority = COALESCE(p_priority, priority),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    status = COALESCE(p_status, status),
    github_repo = COALESCE(p_github_repo, github_repo),
    tags = COALESCE(p_tags, tags),
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- ============================================
-- 5. get_repo_files_with_token - Drop duplicate overload
-- Keep the simpler version, drop the one with extra params
-- ============================================
DROP FUNCTION IF EXISTS public.get_repo_files_with_token(uuid, uuid, text);