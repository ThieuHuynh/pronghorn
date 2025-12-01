-- Create RPC function to update file path in staging table
CREATE OR REPLACE FUNCTION public.update_staged_file_path_with_token(
  p_staging_id uuid,
  p_new_path text,
  p_token uuid
)
RETURNS repo_staging
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staging repo_staging;
  result repo_staging;
BEGIN
  -- Get the staging record
  SELECT * INTO v_staging
  FROM repo_staging
  WHERE id = p_staging_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staged file not found';
  END IF;
  
  -- Validate repo access
  IF NOT validate_repo_access(v_staging.repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Update the file path (keeping old_path for history if needed)
  UPDATE repo_staging
  SET 
    file_path = p_new_path,
    old_path = COALESCE(v_staging.old_path, v_staging.file_path)
  WHERE id = p_staging_id
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;