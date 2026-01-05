-- Make org_id nullable on projects table
ALTER TABLE public.projects ALTER COLUMN org_id DROP NOT NULL;

-- Update insert_project_with_token to make p_org_id optional with default NULL
CREATE OR REPLACE FUNCTION public.insert_project_with_token(
  p_name text,
  p_org_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_scope text DEFAULT NULL,
  p_status project_status DEFAULT 'DESIGN'::project_status
)
RETURNS TABLE(id uuid, share_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_token uuid;
  v_user_id uuid;
BEGIN
  -- Get current user if authenticated
  v_user_id := auth.uid();
  
  -- Insert the project (org_id can be NULL now)
  INSERT INTO public.projects (name, org_id, description, organization, budget, scope, status, created_by)
  VALUES (p_name, p_org_id, p_description, p_organization, p_budget, p_scope, p_status, v_user_id)
  RETURNING projects.id INTO v_project_id;
  
  -- Create an owner token in project_tokens table
  INSERT INTO public.project_tokens (project_id, role, label, created_by)
  VALUES (v_project_id, 'owner', 'Default Owner Token', v_user_id)
  RETURNING token INTO v_token;
  
  -- Return both the project ID and the token
  RETURN QUERY SELECT v_project_id AS id, v_token AS share_token;
END;
$function$;