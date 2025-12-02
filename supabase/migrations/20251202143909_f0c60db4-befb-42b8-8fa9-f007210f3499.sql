-- Create RPC function for chat history retrieval
-- This replaces direct table queries with token-validated access

CREATE OR REPLACE FUNCTION public.get_agent_messages_for_chat_history_with_token(
  p_project_id uuid,
  p_token uuid,
  p_limit integer DEFAULT NULL,
  p_since timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  role text,
  content text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate project access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  IF p_since IS NOT NULL THEN
    -- Time-based filtering
    RETURN QUERY
      SELECT am.id, am.session_id, am.role, am.content, am.created_at
      FROM public.agent_messages am
      INNER JOIN public.agent_sessions ags ON ags.id = am.session_id
      WHERE ags.project_id = p_project_id
        AND am.created_at >= p_since
      ORDER BY am.created_at DESC;
  ELSE
    -- Message count filtering
    RETURN QUERY
      SELECT am.id, am.session_id, am.role, am.content, am.created_at
      FROM public.agent_messages am
      INNER JOIN public.agent_sessions ags ON ags.id = am.session_id
      WHERE ags.project_id = p_project_id
      ORDER BY am.created_at DESC
      LIMIT COALESCE(p_limit, 100);
  END IF;
END;
$function$;