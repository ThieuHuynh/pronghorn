-- Create agent_messages table for persistent conversation history
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for efficient session querying
CREATE INDEX idx_agent_messages_session_id ON public.agent_messages(session_id);
CREATE INDEX idx_agent_messages_created_at ON public.agent_messages(created_at);

-- Enable RLS
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can access messages via token or auth
CREATE POLICY "Users can access agent_messages via token or auth"
ON public.agent_messages
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM agent_sessions
    JOIN projects ON projects.id = agent_sessions.project_id
    WHERE agent_sessions.id = agent_messages.session_id
      AND (
        projects.created_by = auth.uid()
        OR projects.share_token = (current_setting('app.share_token', true))::uuid
      )
  )
);

-- Enable realtime
ALTER TABLE public.agent_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages;

-- RPC function to get agent messages with token
CREATE OR REPLACE FUNCTION public.get_agent_messages_with_token(
  p_session_id UUID,
  p_token UUID
)
RETURNS SETOF agent_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set share token
  PERFORM public.set_share_token(p_token::text);
  
  -- Return messages for this session
  RETURN QUERY
  SELECT *
  FROM public.agent_messages
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
END;
$$;

-- RPC function to insert agent message with token
CREATE OR REPLACE FUNCTION public.insert_agent_message_with_token(
  p_session_id UUID,
  p_token UUID,
  p_role TEXT,
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS agent_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  new_message public.agent_messages;
BEGIN
  -- Get project_id from session
  SELECT project_id INTO v_project_id
  FROM agent_sessions
  WHERE id = p_session_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Validate access
  IF NOT validate_project_access(v_project_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Insert message
  INSERT INTO public.agent_messages (session_id, role, content, metadata)
  VALUES (p_session_id, p_role, p_content, p_metadata)
  RETURNING * INTO new_message;

  RETURN new_message;
END;
$$;

-- RPC function to unstage a single file
CREATE OR REPLACE FUNCTION public.unstage_file_with_token(
  p_repo_id UUID,
  p_file_path TEXT,
  p_token UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Set share token
  PERFORM public.set_share_token(p_token::text);
  
  -- Validate access
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Delete specific staged file
  DELETE FROM public.repo_staging
  WHERE repo_id = p_repo_id
    AND file_path = p_file_path;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- RPC function to unstage multiple files
CREATE OR REPLACE FUNCTION public.unstage_files_with_token(
  p_repo_id UUID,
  p_file_paths TEXT[],
  p_token UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Set share token
  PERFORM public.set_share_token(p_token::text);
  
  -- Validate access
  IF NOT validate_repo_access(p_repo_id, p_token) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Delete specified staged files
  DELETE FROM public.repo_staging
  WHERE repo_id = p_repo_id
    AND file_path = ANY(p_file_paths);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;