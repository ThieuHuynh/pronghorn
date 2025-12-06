-- Part 1: Create profile_linked_projects table for saving shared projects to dashboard
CREATE TABLE IF NOT EXISTS public.profile_linked_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.profile_linked_projects ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own linked projects
CREATE POLICY "Users can manage their own linked projects"
ON public.profile_linked_projects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Part 2: Create RPC to link a shared project
CREATE OR REPLACE FUNCTION public.link_shared_project(
  p_project_id uuid,
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_role project_token_role;
  v_project projects;
  v_result profile_linked_projects;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate token and get role
  v_role := public.authorize_project_access(p_project_id, p_token);

  -- Get project details
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Don't allow linking your own projects (you already own them)
  IF v_project.created_by = v_user_id THEN
    RAISE EXCEPTION 'Cannot link your own project';
  END IF;

  -- Insert or update the link
  INSERT INTO public.profile_linked_projects (user_id, project_id, token)
  VALUES (v_user_id, p_project_id, p_token)
  ON CONFLICT (user_id, project_id)
  DO UPDATE SET token = EXCLUDED.token
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id', v_result.id,
    'project_id', v_result.project_id,
    'role', v_role,
    'project_name', v_project.name
  );
END;
$function$;

-- Part 3: Create RPC to unlink a shared project
CREATE OR REPLACE FUNCTION public.unlink_shared_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.profile_linked_projects
  WHERE user_id = auth.uid()
    AND project_id = p_project_id;
END;
$function$;

-- Part 4: Create RPC to get all linked projects with role info
CREATE OR REPLACE FUNCTION public.get_linked_projects()
RETURNS TABLE(
  id uuid,
  project_id uuid,
  project_name text,
  project_status project_status,
  project_description text,
  project_updated_at timestamp with time zone,
  role project_token_role,
  is_valid boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    plp.id,
    plp.project_id,
    p.name AS project_name,
    p.status AS project_status,
    p.description AS project_description,
    p.updated_at AS project_updated_at,
    COALESCE(pt.role, 'viewer'::project_token_role) AS role,
    (pt.id IS NOT NULL AND (pt.expires_at IS NULL OR pt.expires_at > now())) AS is_valid,
    plp.created_at
  FROM public.profile_linked_projects plp
  LEFT JOIN public.projects p ON p.id = plp.project_id
  LEFT JOIN public.project_tokens pt ON pt.project_id = plp.project_id 
    AND pt.token = plp.token
    AND (pt.expires_at IS NULL OR pt.expires_at > now())
  WHERE plp.user_id = auth.uid()
    AND p.id IS NOT NULL -- Filter out deleted projects
  ORDER BY plp.created_at DESC;
END;
$function$;

-- Part 5: Update save_anonymous_project_to_user to properly validate token from project_tokens
CREATE OR REPLACE FUNCTION public.save_anonymous_project_to_user(p_project_id uuid, p_share_token uuid)
RETURNS projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  updated_project public.projects;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate token exists in project_tokens
  IF NOT EXISTS (
    SELECT 1 FROM public.project_tokens
    WHERE project_id = p_project_id
      AND token = p_share_token
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Only update if project has no owner (anonymous project)
  UPDATE public.projects
  SET created_by = v_user_id
  WHERE id = p_project_id
    AND created_by IS NULL
  RETURNING * INTO updated_project;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already owned';
  END IF;

  RETURN updated_project;
END;
$function$;

-- Part 6: Drop legacy regenerate_share_token function (no longer valid concept)
DROP FUNCTION IF EXISTS public.regenerate_share_token(uuid, uuid);