-- Create dedicated RPC for token regeneration (authenticated owners only)
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
  -- ONLY allow authenticated project owners, not token-based access
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to regenerate token' USING ERRCODE = 'P0001';
  END IF;

  -- Verify user is the project owner
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only project owner can regenerate token' USING ERRCODE = 'P0001';
  END IF;

  -- Generate new token
  new_token := gen_random_uuid();

  -- Update project with new share token
  UPDATE public.projects
  SET share_token = new_token
  WHERE id = p_project_id;

  RETURN new_token;
END;
$function$;