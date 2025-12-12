-- Create table for saved SQL queries
CREATE TABLE public.project_database_sql (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.project_databases(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sql_content text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_database_sql ENABLE ROW LEVEL SECURITY;

-- RLS Policy using same pattern as other project tables
CREATE POLICY "Users can access saved queries"
ON public.project_database_sql
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_database_sql.project_id
    AND (
      p.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_tokens pt
        WHERE pt.project_id = p.id
        AND pt.token = (current_setting('app.share_token', true))::uuid
        AND (pt.expires_at IS NULL OR pt.expires_at > now())
      )
    )
  )
);

-- Create index for faster lookups
CREATE INDEX idx_project_database_sql_database_id ON public.project_database_sql(database_id);
CREATE INDEX idx_project_database_sql_project_id ON public.project_database_sql(project_id);

-- RPC: Get saved queries for a database
CREATE OR REPLACE FUNCTION public.get_saved_queries_with_token(
  p_database_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS SETOF public.project_database_sql
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from database
  SELECT project_id INTO v_project_id FROM public.project_databases WHERE id = p_database_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Database not found';
  END IF;

  -- Validate access (viewer+ can read)
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
  SELECT * FROM public.project_database_sql
  WHERE database_id = p_database_id
  ORDER BY updated_at DESC;
END;
$function$;

-- RPC: Insert saved query
CREATE OR REPLACE FUNCTION public.insert_saved_query_with_token(
  p_database_id uuid,
  p_name text,
  p_sql_content text,
  p_token uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS public.project_database_sql
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_result public.project_database_sql;
BEGIN
  -- Get project_id from database
  SELECT project_id INTO v_project_id FROM public.project_databases WHERE id = p_database_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Database not found';
  END IF;

  -- Validate access (editor+ can create)
  PERFORM public.require_role(v_project_id, p_token, 'editor');

  INSERT INTO public.project_database_sql (database_id, project_id, name, description, sql_content, created_by)
  VALUES (p_database_id, v_project_id, p_name, p_description, p_sql_content, auth.uid())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

-- RPC: Update saved query
CREATE OR REPLACE FUNCTION public.update_saved_query_with_token(
  p_query_id uuid,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_sql_content text DEFAULT NULL
)
RETURNS public.project_database_sql
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_result public.project_database_sql;
BEGIN
  -- Get project_id from query
  SELECT project_id INTO v_project_id FROM public.project_database_sql WHERE id = p_query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found';
  END IF;

  -- Validate access (editor+ can update)
  PERFORM public.require_role(v_project_id, p_token, 'editor');

  UPDATE public.project_database_sql
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    sql_content = COALESCE(p_sql_content, sql_content),
    updated_at = now()
  WHERE id = p_query_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

-- RPC: Delete saved query
CREATE OR REPLACE FUNCTION public.delete_saved_query_with_token(
  p_query_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from query
  SELECT project_id INTO v_project_id FROM public.project_database_sql WHERE id = p_query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found';
  END IF;

  -- Validate access (editor+ can delete)
  PERFORM public.require_role(v_project_id, p_token, 'editor');

  DELETE FROM public.project_database_sql WHERE id = p_query_id;
END;
$function$;