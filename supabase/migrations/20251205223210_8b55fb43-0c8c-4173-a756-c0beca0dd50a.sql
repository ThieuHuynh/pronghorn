-- ============================================
-- SECURITY FIX: Add proper validation to all agent RPC functions
-- ============================================

-- Drop function with changed return type first
DROP FUNCTION IF EXISTS public.request_agent_session_abort_with_token(uuid, uuid);

-- Step 1: Create helper function for session-based validation
CREATE OR REPLACE FUNCTION public.validate_session_access(
  p_session_id uuid,
  p_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from session
  SELECT project_id INTO v_project_id
  FROM public.agent_sessions
  WHERE id = p_session_id;
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0001';
  END IF;
  
  -- Validate project access (handles both auth.uid() and token validation)
  RETURN public.validate_project_access(v_project_id, p_token);
END;
$function$;

-- ============================================
-- Step 2: Fix PROJECT-BASED agent functions
-- ============================================

-- Fix: create_agent_session_with_token
CREATE OR REPLACE FUNCTION public.create_agent_session_with_token(
  p_project_id uuid,
  p_token uuid,
  p_mode text,
  p_task_description text DEFAULT NULL
)
RETURNS agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_session public.agent_sessions;
BEGIN
  -- SECURITY: Validate project access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.agent_sessions (project_id, mode, task_description, created_by)
  VALUES (p_project_id, p_mode, p_task_description, auth.uid())
  RETURNING * INTO new_session;

  RETURN new_session;
END;
$function$;

-- Fix: get_agent_sessions_with_token
CREATE OR REPLACE FUNCTION public.get_agent_sessions_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate project access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_sessions
  WHERE project_id = p_project_id
  ORDER BY created_at DESC;
END;
$function$;

-- Fix: get_agent_messages_by_project_with_token
CREATE OR REPLACE FUNCTION public.get_agent_messages_by_project_with_token(
  p_project_id uuid,
  p_token uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  session_id uuid,
  role text,
  content text,
  metadata jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate project access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
  SELECT am.id, am.session_id, am.role, am.content, am.metadata, am.created_at
  FROM public.agent_messages am
  INNER JOIN public.agent_sessions ags ON ags.id = am.session_id
  WHERE ags.project_id = p_project_id
  ORDER BY am.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Fix: get_agent_operations_by_project_with_token
CREATE OR REPLACE FUNCTION public.get_agent_operations_by_project_with_token(
  p_project_id uuid,
  p_token uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  session_id uuid,
  operation_type text,
  file_path text,
  status text,
  details jsonb,
  error_message text,
  created_at timestamp with time zone,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate project access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
  SELECT afo.id, afo.session_id, afo.operation_type, afo.file_path, afo.status, 
         afo.details, afo.error_message, afo.created_at, afo.completed_at
  FROM public.agent_file_operations afo
  INNER JOIN public.agent_sessions ags ON ags.id = afo.session_id
  WHERE ags.project_id = p_project_id
  ORDER BY afo.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- ============================================
-- Step 3: Fix SESSION-BASED agent functions
-- ============================================

-- Fix: update_agent_session_status_with_token
CREATE OR REPLACE FUNCTION public.update_agent_session_status_with_token(
  p_session_id uuid,
  p_token uuid,
  p_status text,
  p_completed_at timestamp with time zone DEFAULT NULL
)
RETURNS agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated public.agent_sessions;
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  UPDATE public.agent_sessions
  SET 
    status = p_status,
    completed_at = COALESCE(p_completed_at, completed_at),
    updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$function$;

-- Fix: get_agent_session_with_token
CREATE OR REPLACE FUNCTION public.get_agent_session_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_sessions
  WHERE id = p_session_id;
END;
$function$;

-- Fix: request_agent_session_abort_with_token (recreate after drop)
CREATE OR REPLACE FUNCTION public.request_agent_session_abort_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS agent_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated public.agent_sessions;
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  UPDATE public.agent_sessions
  SET abort_requested = true, updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$function$;

-- Fix: add_blackboard_entry_with_token
CREATE OR REPLACE FUNCTION public.add_blackboard_entry_with_token(
  p_session_id uuid,
  p_token uuid,
  p_entry_type text,
  p_content text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS agent_blackboard
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_entry public.agent_blackboard;
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  INSERT INTO public.agent_blackboard (session_id, entry_type, content, metadata)
  VALUES (p_session_id, p_entry_type, p_content, p_metadata)
  RETURNING * INTO new_entry;

  RETURN new_entry;
END;
$function$;

-- Fix: get_blackboard_entries_with_token
CREATE OR REPLACE FUNCTION public.get_blackboard_entries_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_blackboard
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_blackboard
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
END;
$function$;

-- Fix: add_session_context_with_token
CREATE OR REPLACE FUNCTION public.add_session_context_with_token(
  p_session_id uuid,
  p_token uuid,
  p_context_type text,
  p_context_data jsonb
)
RETURNS agent_session_context
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_context public.agent_session_context;
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  INSERT INTO public.agent_session_context (session_id, context_type, context_data)
  VALUES (p_session_id, p_context_type, p_context_data)
  RETURNING * INTO new_context;

  RETURN new_context;
END;
$function$;

-- Fix: get_session_context_with_token
CREATE OR REPLACE FUNCTION public.get_session_context_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_session_context
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_session_context
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
END;
$function$;

-- Fix: get_agent_messages_with_token
CREATE OR REPLACE FUNCTION public.get_agent_messages_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_messages
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
END;
$function$;

-- Fix: log_agent_operation_with_token
CREATE OR REPLACE FUNCTION public.log_agent_operation_with_token(
  p_session_id uuid,
  p_token uuid,
  p_operation_type text,
  p_file_path text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS agent_file_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_op public.agent_file_operations;
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  INSERT INTO public.agent_file_operations (session_id, operation_type, file_path, status, details)
  VALUES (p_session_id, p_operation_type, p_file_path, p_status, p_details)
  RETURNING * INTO new_op;

  RETURN new_op;
END;
$function$;

-- Fix: update_agent_operation_status_with_token
CREATE OR REPLACE FUNCTION public.update_agent_operation_status_with_token(
  p_operation_id uuid,
  p_token uuid,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS agent_file_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid;
  updated public.agent_file_operations;
BEGIN
  -- Get session_id from operation
  SELECT session_id INTO v_session_id
  FROM public.agent_file_operations
  WHERE id = p_operation_id;
  
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Operation not found' USING ERRCODE = 'P0001';
  END IF;

  -- SECURITY: Validate session access
  PERFORM public.validate_session_access(v_session_id, p_token);

  UPDATE public.agent_file_operations
  SET 
    status = p_status,
    error_message = p_error_message,
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE completed_at END
  WHERE id = p_operation_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$function$;

-- Fix: get_agent_operations_with_token
CREATE OR REPLACE FUNCTION public.get_agent_operations_with_token(
  p_session_id uuid,
  p_token uuid
)
RETURNS SETOF agent_file_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Validate session access first
  PERFORM public.validate_session_access(p_session_id, p_token);

  RETURN QUERY
  SELECT *
  FROM public.agent_file_operations
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
END;
$function$;