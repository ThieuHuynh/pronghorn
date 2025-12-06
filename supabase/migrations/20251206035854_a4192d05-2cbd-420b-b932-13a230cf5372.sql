-- Fix RLS circular dependency between projects and project_tokens tables
-- Following the established pattern with has_role() SECURITY DEFINER helper function

-- Step 1: Create is_project_owner helper function (bypasses RLS for internal checks)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  )
$$;

-- Step 2: Create is_valid_token_for_project helper function (bypasses RLS for internal checks)
CREATE OR REPLACE FUNCTION public.is_valid_token_for_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_tokens
    WHERE project_id = p_project_id
      AND token = NULLIF(current_setting('app.share_token', true), '')::uuid
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Step 3: Update projects RLS policy to use helper functions (breaks circular dependency)
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;

CREATE POLICY "Users can view projects"
ON public.projects
FOR SELECT
USING (
  auth.uid() = created_by
  OR
  public.is_valid_token_for_project(id)
);

-- Step 4: Update project_tokens RLS policy to use helper function (breaks circular dependency)
DROP POLICY IF EXISTS "Project owners can manage tokens" ON public.project_tokens;

CREATE POLICY "Project owners can manage tokens"
ON public.project_tokens
FOR ALL
USING (
  public.is_project_owner(project_id)
);

-- Step 5: Fix get_linked_projects to use SECURITY INVOKER and rely on fixed RLS
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
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- User must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
    LEFT JOIN public.project_tokens pt ON pt.project_id = plp.project_id AND pt.token = plp.token
    WHERE plp.user_id = auth.uid()
      AND p.id IS NOT NULL
    ORDER BY plp.created_at DESC;
END;
$function$;