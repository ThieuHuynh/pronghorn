-- Update insert_deployment_with_token to accept p_env_vars parameter
CREATE OR REPLACE FUNCTION public.insert_deployment_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_environment deployment_environment DEFAULT 'dev',
  p_platform deployment_platform DEFAULT 'pronghorn_cloud',
  p_project_type text DEFAULT 'node',
  p_run_folder text DEFAULT '/',
  p_build_folder text DEFAULT 'dist',
  p_run_command text DEFAULT 'npm run dev',
  p_build_command text DEFAULT 'npm run build',
  p_branch text DEFAULT 'main',
  p_repo_id uuid DEFAULT NULL,
  p_env_vars jsonb DEFAULT '{}'::jsonb
)
RETURNS project_deployments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result project_deployments;
BEGIN
  -- Validate access - require at least editor role
  PERFORM public.require_role(p_project_id, p_token, 'editor');
  
  INSERT INTO public.project_deployments (
    project_id, name, environment, platform, project_type,
    run_folder, build_folder, run_command, build_command, branch, repo_id, 
    env_vars, created_by
  )
  VALUES (
    p_project_id, p_name, p_environment, p_platform, p_project_type,
    p_run_folder, p_build_folder, p_run_command, p_build_command, p_branch, p_repo_id,
    p_env_vars, auth.uid()
  )
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;