-- Drop and recreate upsert_file_with_token to fix ambiguous column reference
DROP FUNCTION IF EXISTS public.upsert_file_with_token(uuid, text, text, uuid, text);

CREATE FUNCTION public.upsert_file_with_token(
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
  -- Set share token in session
  PERFORM public.set_share_token(p_token::text);

  -- Upsert file with explicit table qualification to avoid ambiguous column references
  RETURN QUERY
  INSERT INTO public.repo_files (repo_id, project_id, path, content, last_commit_sha)
  SELECT 
    p_repo_id,
    pr.project_id,
    p_path,
    p_content,
    COALESCE(p_commit_sha, rf.last_commit_sha)
  FROM public.project_repos pr
  LEFT JOIN public.repo_files rf ON rf.repo_id = p_repo_id AND rf.path = p_path
  WHERE pr.id = p_repo_id
  ON CONFLICT (repo_id, path)
  DO UPDATE SET
    content = EXCLUDED.content,
    last_commit_sha = EXCLUDED.last_commit_sha,
    updated_at = now()
  RETURNING repo_files.*;
END;
$function$;