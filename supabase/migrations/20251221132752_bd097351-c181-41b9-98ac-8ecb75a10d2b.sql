-- Remove FK constraint from artifact_collaboration_messages.token_id
-- This allows tokens to be deleted/regenerated without breaking message history
ALTER TABLE public.artifact_collaboration_messages
  DROP CONSTRAINT IF EXISTS artifact_collaboration_messages_token_id_fkey;

-- Create function to regenerate a token (roll key)
CREATE OR REPLACE FUNCTION public.roll_project_token_with_token(
  p_token_id uuid,
  p_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_old_token uuid;
  v_new_token uuid;
BEGIN
  -- Get project_id and current token value
  SELECT project_id, token INTO v_project_id, v_old_token
  FROM public.project_tokens
  WHERE id = p_token_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found' USING ERRCODE = 'P0001';
  END IF;
  
  -- Require owner role
  PERFORM public.require_role(v_project_id, p_token, 'owner');
  
  -- Generate new token UUID
  v_new_token := gen_random_uuid();
  
  -- Update the token
  UPDATE public.project_tokens
  SET token = v_new_token
  WHERE id = p_token_id;
  
  -- Update profile_linked_projects that reference the old token
  UPDATE public.profile_linked_projects
  SET token = v_new_token
  WHERE project_id = v_project_id AND token = v_old_token;
  
  RETURN v_new_token;
END;
$$;