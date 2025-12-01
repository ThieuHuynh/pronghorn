-- Fix create_file_with_token to handle duplicates
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
  result public.repo_files;
BEGIN
  -- Get project_id from repo
  SELECT project_id INTO v_project_id
  FROM public.project_repos
  WHERE id = p_repo_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Repository not found';
  END IF;

  -- Set share token in Postgres session
  PERFORM public.set_share_token(p_token::text);

  -- Check if file already exists
  IF EXISTS (SELECT 1 FROM public.repo_files WHERE repo_id = p_repo_id AND path = p_path) THEN
    RAISE EXCEPTION 'File already exists at path: %', p_path USING ERRCODE = 'P0001';
  END IF;

  -- Insert new file and return
  INSERT INTO public.repo_files (repo_id, project_id, path, content)
  VALUES (p_repo_id, v_project_id, p_path, p_content)
  RETURNING * INTO result;

  RETURN result;
END;
$function$;