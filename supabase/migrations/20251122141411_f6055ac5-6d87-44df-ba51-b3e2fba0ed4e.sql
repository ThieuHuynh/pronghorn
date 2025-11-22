-- Create RPC function for deleting projects with token validation
CREATE OR REPLACE FUNCTION public.delete_project_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Set the share token for RLS validation
  PERFORM public.set_share_token(p_token::text);

  -- Delete the project (cascading deletes will handle related records)
  DELETE FROM public.projects
  WHERE id = p_project_id;
END;
$function$;

-- Create RPC function for inserting projects with token (returns project with share_token)
CREATE OR REPLACE FUNCTION public.insert_project_with_token(
  p_name text,
  p_org_id uuid,
  p_description text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_scope text DEFAULT NULL,
  p_status project_status DEFAULT 'DESIGN'
)
RETURNS projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_project public.projects;
BEGIN
  -- Insert new project with auto-generated share_token
  INSERT INTO public.projects (
    name,
    org_id,
    description,
    organization,
    budget,
    scope,
    status,
    created_by,
    share_token
  )
  VALUES (
    p_name,
    p_org_id,
    p_description,
    p_organization,
    p_budget,
    p_scope,
    p_status,
    auth.uid(), -- Set to current user if authenticated, NULL if anonymous
    gen_random_uuid() -- Auto-generate share token
  )
  RETURNING * INTO new_project;

  RETURN new_project;
END;
$function$;

-- Create RPC function to regenerate share token for a project
CREATE OR REPLACE FUNCTION public.regenerate_share_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_token uuid;
BEGIN
  -- Set the share token for RLS validation
  PERFORM public.set_share_token(p_token::text);

  -- Generate new token
  new_token := gen_random_uuid();

  -- Update project with new share token
  UPDATE public.projects
  SET share_token = new_token
  WHERE id = p_project_id;

  RETURN new_token;
END;
$function$;

-- Create RPC function to link anonymous project to authenticated user
CREATE OR REPLACE FUNCTION public.save_anonymous_project_to_user(
  p_project_id uuid,
  p_share_token uuid
)
RETURNS projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_project public.projects;
BEGIN
  -- Verify the share token matches
  PERFORM public.set_share_token(p_share_token::text);

  -- Update project to link to current authenticated user
  UPDATE public.projects
  SET created_by = auth.uid()
  WHERE id = p_project_id
    AND share_token = p_share_token
  RETURNING * INTO updated_project;

  RETURN updated_project;
END;
$function$;