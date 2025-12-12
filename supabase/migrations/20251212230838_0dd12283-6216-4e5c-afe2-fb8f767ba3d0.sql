-- Create project_migrations table for tracking DDL statements
CREATE TABLE public.project_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.project_databases(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  name text,
  sql_content text NOT NULL,
  statement_type text NOT NULL,
  object_type text NOT NULL,
  object_schema text DEFAULT 'public',
  object_name text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_migrations ENABLE ROW LEVEL SECURITY;

-- Create policy for project access
CREATE POLICY "Users can access project migrations" ON public.project_migrations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_migrations.project_id
    AND (p.created_by = auth.uid() OR is_valid_token_for_project(p.id))
  ));

-- Add index for ordering
CREATE INDEX idx_project_migrations_order 
  ON public.project_migrations(database_id, sequence_number);

-- Create RPC function to get migrations
CREATE OR REPLACE FUNCTION public.get_migrations_with_token(
  p_database_id uuid,
  p_token uuid DEFAULT NULL
)
RETURNS SETOF project_migrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id FROM public.project_databases WHERE id = p_database_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Database not found'; END IF;
  
  PERFORM public.require_role(v_project_id, p_token, 'viewer');
  
  RETURN QUERY
  SELECT * FROM public.project_migrations
  WHERE database_id = p_database_id
  ORDER BY sequence_number ASC;
END;
$function$;

-- Create RPC function to insert migration
CREATE OR REPLACE FUNCTION public.insert_migration_with_token(
  p_database_id uuid,
  p_sql_content text,
  p_statement_type text,
  p_object_type text,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_object_schema text DEFAULT 'public',
  p_object_name text DEFAULT NULL
)
RETURNS project_migrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_next_seq integer;
  v_result public.project_migrations;
BEGIN
  SELECT project_id INTO v_project_id FROM public.project_databases WHERE id = p_database_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Database not found'; END IF;
  
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Get next sequence number
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_next_seq
  FROM public.project_migrations
  WHERE database_id = p_database_id;
  
  -- Generate name if not provided
  INSERT INTO public.project_migrations (
    database_id, project_id, sequence_number, name, sql_content,
    statement_type, object_type, object_schema, object_name, executed_by
  )
  VALUES (
    p_database_id, v_project_id, v_next_seq,
    COALESCE(p_name, v_next_seq || '_' || LOWER(p_statement_type) || '_' || LOWER(p_object_type) || '_' || COALESCE(LOWER(p_object_name), 'unnamed')),
    p_sql_content, p_statement_type, p_object_type, p_object_schema, p_object_name, auth.uid()
  )
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Create RPC function to delete migration
CREATE OR REPLACE FUNCTION public.delete_migration_with_token(
  p_migration_id uuid,
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
  SELECT project_id INTO v_project_id FROM public.project_migrations WHERE id = p_migration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration not found'; END IF;
  
  PERFORM public.require_role(v_project_id, p_token, 'owner');
  
  DELETE FROM public.project_migrations WHERE id = p_migration_id;
END;
$function$;