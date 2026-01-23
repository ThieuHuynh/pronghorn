-- Drop existing functions first to handle parameter default changes
DROP FUNCTION IF EXISTS public.get_deployment_with_secrets_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.delete_deployment_with_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.update_deployment_secrets_with_token(uuid, uuid, jsonb);

-- Recreate get_deployment_with_secrets_with_token to allow editor access
CREATE OR REPLACE FUNCTION public.get_deployment_with_secrets_with_token(
  p_deployment_id uuid, 
  p_token uuid
)
RETURNS public.project_deployments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.project_deployments;
BEGIN
  SELECT project_id INTO v_project_id 
  FROM public.project_deployments 
  WHERE id = p_deployment_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Deployment not found'; 
  END IF;
  
  -- Changed from owner-only check to editor role requirement
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  SELECT * INTO result 
  FROM public.project_deployments 
  WHERE id = p_deployment_id;
  
  RETURN result;
END;
$function$;

-- Recreate delete_deployment_with_token to allow editor access
CREATE OR REPLACE FUNCTION public.delete_deployment_with_token(
  p_deployment_id uuid, 
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id 
  FROM public.project_deployments 
  WHERE id = p_deployment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deployment not found';
  END IF;
  
  -- Changed from owner to editor role requirement
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  DELETE FROM public.project_deployments 
  WHERE id = p_deployment_id;
END;
$function$;

-- Recreate update_deployment_secrets_with_token to allow editor access
CREATE OR REPLACE FUNCTION public.update_deployment_secrets_with_token(
  p_deployment_id uuid, 
  p_token uuid, 
  p_secrets jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id 
  FROM public.project_deployments 
  WHERE id = p_deployment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deployment not found';
  END IF;
  
  -- Changed from owner to editor role requirement
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  UPDATE public.project_deployments
  SET secrets = p_secrets, updated_at = now()
  WHERE id = p_deployment_id;
END;
$function$;