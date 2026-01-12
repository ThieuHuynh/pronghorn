-- Function to delete an individual chat message with token-based access
CREATE OR REPLACE FUNCTION public.delete_chat_message_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from the message
  SELECT project_id INTO v_project_id 
  FROM public.chat_messages 
  WHERE id = p_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Chat message not found'; 
  END IF;
  
  -- Require editor role
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Delete the message
  DELETE FROM public.chat_messages WHERE id = p_id;
END;
$$;

-- Function to clone a chat session including all its messages
CREATE OR REPLACE FUNCTION public.clone_chat_session_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_original_title text;
  v_original_ai_title text;
  v_original_ai_summary text;
  new_session public.chat_sessions;
BEGIN
  -- Get source session details
  SELECT project_id, title, ai_title, ai_summary 
  INTO v_project_id, v_original_title, v_original_ai_title, v_original_ai_summary
  FROM public.chat_sessions 
  WHERE id = p_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Chat session not found'; 
  END IF;
  
  -- Require editor role
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Create new session with "(Copy)" suffix
  INSERT INTO public.chat_sessions (
    project_id, 
    title, 
    ai_title,
    ai_summary,
    created_by
  ) VALUES (
    v_project_id, 
    COALESCE(v_original_title, 'New Chat') || ' (Copy)',
    CASE WHEN v_original_ai_title IS NOT NULL 
         THEN v_original_ai_title || ' (Copy)' 
         ELSE NULL END,
    v_original_ai_summary,
    auth.uid()
  ) RETURNING * INTO new_session;
  
  -- Clone all messages from original session to new session
  INSERT INTO public.chat_messages (
    chat_session_id,
    project_id,
    role,
    content,
    created_by
  )
  SELECT 
    new_session.id,
    v_project_id,
    role,
    content,
    auth.uid()
  FROM public.chat_messages
  WHERE chat_session_id = p_id
  ORDER BY created_at ASC;
  
  RETURN new_session;
END;
$$;