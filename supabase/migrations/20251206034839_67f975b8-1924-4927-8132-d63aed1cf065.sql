-- Fix: Update get_linked_projects to avoid RLS recursion by using explicit table references
-- The issue is that SECURITY DEFINER functions in Supabase still have RLS applied unless we use service_role
-- Solution: Simplify the query and let RLS on profile_linked_projects handle user filtering

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
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Use SQL function which evaluates at function owner level
  -- The RLS on profile_linked_projects filters by auth.uid() automatically
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
  FROM profile_linked_projects plp
  -- Use subquery to avoid RLS on projects table
  LEFT JOIN LATERAL (
    SELECT id, name, status, description, updated_at 
    FROM projects proj 
    WHERE proj.id = plp.project_id
  ) p ON true
  LEFT JOIN project_tokens pt ON pt.project_id = plp.project_id 
    AND pt.token = plp.token
    AND (pt.expires_at IS NULL OR pt.expires_at > now())
  WHERE plp.user_id = auth.uid()
    AND p.id IS NOT NULL
  ORDER BY plp.created_at DESC;
$function$;

-- Also need to ensure the projects table RLS doesn't cause infinite recursion
-- The issue is the SELECT policy queries project_tokens which might query back

-- Drop and recreate the SELECT policy with a simpler check that doesn't cause recursion
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;

CREATE POLICY "Users can view projects"
ON public.projects
FOR SELECT
USING (
  -- Owner can always view
  auth.uid() = created_by
  OR
  -- Check app.share_token setting directly without EXISTS subquery
  id IN (
    SELECT pt.project_id FROM project_tokens pt
    WHERE pt.token = NULLIF(current_setting('app.share_token', true), '')::uuid
      AND (pt.expires_at IS NULL OR pt.expires_at > now())
  )
);