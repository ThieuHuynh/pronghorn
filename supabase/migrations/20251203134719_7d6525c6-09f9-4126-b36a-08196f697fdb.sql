CREATE OR REPLACE FUNCTION public.stage_file_change_with_token(
  p_repo_id uuid,
  p_token uuid,
  p_operation_type text,
  p_file_path text,
  p_old_content text DEFAULT NULL,
  p_new_content text DEFAULT NULL,
  p_old_path text DEFAULT NULL,
  p_is_binary boolean DEFAULT false
)
RETURNS repo_staging
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.repo_staging;
BEGIN
  -- Set share token
  PERFORM public.set_share_token(p_token::text);
  
  -- Validate access
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Get project_id
  SELECT project_id INTO v_project_id
  FROM project_repos
  WHERE id = p_repo_id;
  
  -- UPSERT staging entry
  INSERT INTO public.repo_staging (
    repo_id,
    project_id,
    file_path,
    operation_type,
    old_content,
    new_content,
    old_path,
    is_binary,
    created_by
  )
  VALUES (
    p_repo_id,
    v_project_id,
    p_file_path,
    p_operation_type,
    p_old_content,
    p_new_content,
    p_old_path,
    p_is_binary,
    auth.uid()
  )
  ON CONFLICT (repo_id, file_path)
  DO UPDATE SET
    operation_type = CASE 
      WHEN repo_staging.operation_type = 'add' THEN 'add'
      ELSE EXCLUDED.operation_type 
    END,
    new_content = EXCLUDED.new_content,
    old_path = EXCLUDED.old_path,
    is_binary = EXCLUDED.is_binary,
    created_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;