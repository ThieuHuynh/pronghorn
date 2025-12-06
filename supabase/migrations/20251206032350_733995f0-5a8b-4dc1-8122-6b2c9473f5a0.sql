-- Drop old function and recreate with new return type
DROP FUNCTION IF EXISTS public.insert_project_with_token(text, uuid, text, text, numeric, text, project_status);

CREATE OR REPLACE FUNCTION public.insert_project_with_token(
  p_name text, 
  p_org_id uuid, 
  p_description text DEFAULT NULL, 
  p_organization text DEFAULT NULL, 
  p_budget numeric DEFAULT NULL, 
  p_scope text DEFAULT NULL, 
  p_status project_status DEFAULT 'DESIGN'::project_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_project public.projects;
  new_token public.project_tokens;
BEGIN
  -- Insert new project
  INSERT INTO public.projects (
    name,
    org_id,
    description,
    organization,
    budget,
    scope,
    status,
    created_by
  )
  VALUES (
    p_name,
    p_org_id,
    p_description,
    p_organization,
    p_budget,
    p_scope,
    p_status,
    auth.uid()
  )
  RETURNING * INTO new_project;

  -- Auto-create an owner token for immediate access
  INSERT INTO public.project_tokens (project_id, token, role, label, created_by)
  VALUES (new_project.id, gen_random_uuid(), 'owner', 'Default Owner Token', auth.uid())
  RETURNING * INTO new_token;

  -- Return project data with token for URL navigation
  RETURN jsonb_build_object(
    'id', new_project.id,
    'name', new_project.name,
    'description', new_project.description,
    'organization', new_project.organization,
    'budget', new_project.budget,
    'scope', new_project.scope,
    'status', new_project.status,
    'created_by', new_project.created_by,
    'created_at', new_project.created_at,
    'updated_at', new_project.updated_at,
    'org_id', new_project.org_id,
    'share_token', new_token.token  -- Return the auto-created token for backward compat
  );
END;
$function$;