-- Fix rollback_to_commit_with_token: Remove DESTRUCTIVE new version, update original with RBAC fix only

-- Step 1: Drop the broken new version (completely wrong logic - deletes data!)
DROP FUNCTION IF EXISTS public.rollback_to_commit_with_token(uuid, uuid, text);

-- Step 2: Update the original version with ONLY the RBAC fix (preserving ALL original logic)
CREATE OR REPLACE FUNCTION public.rollback_to_commit_with_token(p_repo_id uuid, p_token uuid, p_commit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_commit_sha TEXT;
BEGIN
  -- FIXED: Use require_role instead of validate_repo_access
  v_project_id := public.get_project_id_from_repo(p_repo_id);
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Repository not found';
  END IF;
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Get commit SHA (original logic preserved)
  SELECT sha INTO v_commit_sha
  FROM repo_commits
  WHERE id = p_commit_id AND repo_id = p_repo_id;
  
  IF v_commit_sha IS NULL THEN
    RAISE EXCEPTION 'Commit not found';
  END IF;
  
  -- This function marks the intent to rollback
  -- The actual GitHub pull to this commit SHA will be handled by sync-repo-pull edge function
  -- Store the target commit SHA in a session variable for the edge function to use
  PERFORM set_config('app.rollback_commit_sha', v_commit_sha, false);
  
  RETURN true;
END;
$function$;