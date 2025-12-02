-- Add abort_requested column to agent_sessions
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS abort_requested BOOLEAN DEFAULT false;

-- RPC function to request agent session abort
CREATE OR REPLACE FUNCTION request_agent_session_abort_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set share token for RLS validation
  PERFORM public.set_share_token(p_token::text);
  
  -- Update session to request abort
  UPDATE agent_sessions
  SET abort_requested = true,
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- RPC function to get single agent session (needed for abort checking)
CREATE OR REPLACE FUNCTION get_agent_session_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set share token for RLS validation
  PERFORM public.set_share_token(p_token::text);
  
  -- Return session
  RETURN QUERY
    SELECT *
    FROM agent_sessions
    WHERE id = p_session_id;
END;
$$;