-- Fix staging duplicate issue by updating stage_file_change_with_token to use UPSERT

CREATE OR REPLACE FUNCTION public.stage_file_change_with_token(
  p_repo_id UUID,
  p_token UUID,
  p_operation_type TEXT,
  p_file_path TEXT,
  p_old_content TEXT DEFAULT NULL,
  p_new_content TEXT DEFAULT NULL,
  p_old_path TEXT DEFAULT NULL
)
RETURNS repo_staging
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
  result public.repo_staging;
  v_existing_old_content TEXT;
BEGIN
  -- Set share token
  PERFORM public.set_share_token(p_token::text);
  
  -- Validate access and get project_id
  SELECT project_id INTO v_project_id
  FROM project_repos
  WHERE id = p_repo_id;
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Repository not found';
  END IF;
  
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Check if file is already staged to preserve original old_content baseline
  SELECT old_content INTO v_existing_old_content
  FROM public.repo_staging
  WHERE repo_id = p_repo_id AND file_path = p_file_path;
  
  -- UPSERT staging entry (insert or update if already exists)
  -- Preserve original old_content if file was already staged
  INSERT INTO public.repo_staging (
    repo_id,
    project_id,
    operation_type,
    file_path,
    old_content,
    new_content,
    old_path,
    created_by
  )
  VALUES (
    p_repo_id,
    v_project_id,
    p_operation_type,
    p_file_path,
    COALESCE(v_existing_old_content, p_old_content),
    p_new_content,
    p_old_path,
    auth.uid()
  )
  ON CONFLICT (repo_id, file_path)
  DO UPDATE SET
    operation_type = EXCLUDED.operation_type,
    new_content = EXCLUDED.new_content,
    old_path = EXCLUDED.old_path,
    created_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;