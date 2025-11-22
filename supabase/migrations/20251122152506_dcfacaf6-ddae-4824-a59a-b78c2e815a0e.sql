-- Create a helper function to validate project access
-- Returns true if user has access (either owner OR valid token), raises exception otherwise
CREATE OR REPLACE FUNCTION public.validate_project_access(
  p_project_id uuid,
  p_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.projects;
BEGIN
  -- First check: authenticated owner
  IF auth.uid() IS NOT NULL THEN
    SELECT *
    INTO v_project
    FROM public.projects
    WHERE id = p_project_id
      AND created_by = auth.uid();
      
    IF FOUND THEN
      RETURN true;
    END IF;
  END IF;

  -- Second check: valid share token
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Share token is required for this project' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id
    AND share_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid share token for project' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$function$;

-- Fix get_requirements_with_token
CREATE OR REPLACE FUNCTION public.get_requirements_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.requirements
    WHERE project_id = p_project_id
    ORDER BY order_index ASC;
END;
$function$;

-- Fix insert_requirement_with_token
CREATE OR REPLACE FUNCTION public.insert_requirement_with_token(
  p_project_id uuid,
  p_token uuid,
  p_parent_id uuid,
  p_type requirement_type,
  p_title text
)
RETURNS requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_req public.requirements;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.requirements (project_id, parent_id, type, title)
  VALUES (p_project_id, p_parent_id, p_type, p_title)
  RETURNING * INTO new_req;

  RETURN new_req;
END;
$function$;

-- Fix update_requirement_with_token
CREATE OR REPLACE FUNCTION public.update_requirement_with_token(
  p_id uuid,
  p_token uuid,
  p_title text,
  p_content text
)
RETURNS requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  updated public.requirements;
BEGIN
  -- Get project_id from requirement
  SELECT project_id INTO v_project_id
  FROM public.requirements
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  UPDATE public.requirements
  SET
    title = COALESCE(p_title, title),
    content = p_content,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$function$;

-- Fix delete_requirement_with_token
CREATE OR REPLACE FUNCTION public.delete_requirement_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from requirement
  SELECT project_id INTO v_project_id
  FROM public.requirements
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.requirements
  WHERE id = p_id;
END;
$function$;

-- Fix get_canvas_nodes_with_token
CREATE OR REPLACE FUNCTION public.get_canvas_nodes_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF canvas_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.canvas_nodes
    WHERE project_id = p_project_id;
END;
$function$;

-- Fix get_canvas_edges_with_token
CREATE OR REPLACE FUNCTION public.get_canvas_edges_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF canvas_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.canvas_edges
    WHERE project_id = p_project_id;
END;
$function$;

-- Fix get_canvas_layers_with_token
CREATE OR REPLACE FUNCTION public.get_canvas_layers_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL::uuid
)
RETURNS SETOF canvas_layers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT * FROM public.canvas_layers
    WHERE project_id = p_project_id
    ORDER BY created_at ASC;
END;
$function$;

-- Fix upsert_canvas_node_with_token
CREATE OR REPLACE FUNCTION public.upsert_canvas_node_with_token(
  p_id uuid,
  p_project_id uuid,
  p_token uuid,
  p_type node_type,
  p_position jsonb,
  p_data jsonb
)
RETURNS canvas_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.canvas_nodes;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.canvas_nodes (id, project_id, type, position, data)
  VALUES (p_id, p_project_id, p_type, p_position, p_data)
  ON CONFLICT (id) DO UPDATE
    SET
      type = EXCLUDED.type,
      position = EXCLUDED.position,
      data = EXCLUDED.data,
      updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix upsert_canvas_edge_with_token
CREATE OR REPLACE FUNCTION public.upsert_canvas_edge_with_token(
  p_id uuid,
  p_project_id uuid,
  p_token uuid,
  p_source_id uuid,
  p_target_id uuid,
  p_label text,
  p_edge_type text DEFAULT 'default'::text,
  p_style jsonb DEFAULT '{}'::jsonb
)
RETURNS canvas_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.canvas_edges;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.canvas_edges (id, project_id, source_id, target_id, label, edge_type, style)
  VALUES (p_id, p_project_id, p_source_id, p_target_id, p_label, p_edge_type, p_style)
  ON CONFLICT (id) DO UPDATE
    SET
      source_id = EXCLUDED.source_id,
      target_id = EXCLUDED.target_id,
      label = EXCLUDED.label,
      edge_type = EXCLUDED.edge_type,
      style = EXCLUDED.style
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix upsert_canvas_layer_with_token
CREATE OR REPLACE FUNCTION public.upsert_canvas_layer_with_token(
  p_id uuid,
  p_project_id uuid,
  p_token uuid DEFAULT NULL::uuid,
  p_name text DEFAULT 'Untitled Layer'::text,
  p_node_ids text[] DEFAULT '{}'::text[],
  p_visible boolean DEFAULT true
)
RETURNS canvas_layers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.canvas_layers;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);
  
  INSERT INTO public.canvas_layers (id, project_id, name, node_ids, visible)
  VALUES (p_id, p_project_id, p_name, p_node_ids, p_visible)
  ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      node_ids = EXCLUDED.node_ids,
      visible = EXCLUDED.visible,
      updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;

-- Fix delete_canvas_node_with_token
CREATE OR REPLACE FUNCTION public.delete_canvas_node_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from node
  SELECT project_id INTO v_project_id
  FROM public.canvas_nodes
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canvas node not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.canvas_nodes
  WHERE id = p_id;
END;
$function$;

-- Fix delete_canvas_edge_with_token
CREATE OR REPLACE FUNCTION public.delete_canvas_edge_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from edge
  SELECT project_id INTO v_project_id
  FROM public.canvas_edges
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canvas edge not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.canvas_edges
  WHERE id = p_id;
END;
$function$;

-- Fix delete_canvas_layer_with_token
CREATE OR REPLACE FUNCTION public.delete_canvas_layer_with_token(
  p_id uuid,
  p_token uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from layer
  SELECT project_id INTO v_project_id
  FROM public.canvas_layers
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canvas layer not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);
  
  DELETE FROM public.canvas_layers
  WHERE id = p_id;
END;
$function$;

-- Fix get_project_standards_with_token
CREATE OR REPLACE FUNCTION public.get_project_standards_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF project_standards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.project_standards
    WHERE project_id = p_project_id;
END;
$function$;

-- Fix insert_project_standard_with_token
CREATE OR REPLACE FUNCTION public.insert_project_standard_with_token(
  p_project_id uuid,
  p_token uuid,
  p_standard_id uuid
)
RETURNS project_standards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.project_standards;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.project_standards (project_id, standard_id)
  VALUES (p_project_id, p_standard_id)
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix delete_project_standard_with_token
CREATE OR REPLACE FUNCTION public.delete_project_standard_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from project_standard
  SELECT project_id INTO v_project_id
  FROM public.project_standards
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project standard not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.project_standards
  WHERE id = p_id;
END;
$function$;

-- Fix get_project_tech_stacks_with_token
CREATE OR REPLACE FUNCTION public.get_project_tech_stacks_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF project_tech_stacks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.project_tech_stacks
    WHERE project_id = p_project_id;
END;
$function$;

-- Fix insert_project_tech_stack_with_token
CREATE OR REPLACE FUNCTION public.insert_project_tech_stack_with_token(
  p_project_id uuid,
  p_token uuid,
  p_tech_stack_id uuid
)
RETURNS project_tech_stacks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.project_tech_stacks;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.project_tech_stacks (project_id, tech_stack_id)
  VALUES (p_project_id, p_tech_stack_id)
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix delete_project_tech_stack_with_token
CREATE OR REPLACE FUNCTION public.delete_project_tech_stack_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from project_tech_stack
  SELECT project_id INTO v_project_id
  FROM public.project_tech_stacks
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project tech stack not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.project_tech_stacks
  WHERE id = p_id;
END;
$function$;

-- Fix get_requirement_standards_with_token
CREATE OR REPLACE FUNCTION public.get_requirement_standards_with_token(
  p_requirement_id uuid,
  p_token uuid
)
RETURNS SETOF requirement_standards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from requirement
  SELECT project_id INTO v_project_id
  FROM public.requirements
  WHERE id = p_requirement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.requirement_standards
    WHERE requirement_id = p_requirement_id;
END;
$function$;

-- Fix insert_requirement_standard_with_token
CREATE OR REPLACE FUNCTION public.insert_requirement_standard_with_token(
  p_requirement_id uuid,
  p_token uuid,
  p_standard_id uuid,
  p_notes text DEFAULT NULL::text
)
RETURNS requirement_standards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.requirement_standards;
BEGIN
  -- Get project_id from requirement
  SELECT project_id INTO v_project_id
  FROM public.requirements
  WHERE id = p_requirement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  INSERT INTO public.requirement_standards (requirement_id, standard_id, notes)
  VALUES (p_requirement_id, p_standard_id, p_notes)
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix update_requirement_standard_with_token
CREATE OR REPLACE FUNCTION public.update_requirement_standard_with_token(
  p_id uuid,
  p_token uuid,
  p_notes text
)
RETURNS requirement_standards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.requirement_standards;
BEGIN
  -- Get project_id from requirement through requirement_standards
  SELECT r.project_id INTO v_project_id
  FROM public.requirement_standards rs
  JOIN public.requirements r ON r.id = rs.requirement_id
  WHERE rs.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement standard not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  UPDATE public.requirement_standards
  SET notes = p_notes
  WHERE id = p_id
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix delete_requirement_standard_with_token
CREATE OR REPLACE FUNCTION public.delete_requirement_standard_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from requirement through requirement_standards
  SELECT r.project_id INTO v_project_id
  FROM public.requirement_standards rs
  JOIN public.requirements r ON r.id = rs.requirement_id
  WHERE rs.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement standard not found' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  DELETE FROM public.requirement_standards
  WHERE id = p_id;
END;
$function$;

-- Fix get_project_specification_with_token
CREATE OR REPLACE FUNCTION public.get_project_specification_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS project_specifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.project_specifications;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  SELECT *
  INTO result
  FROM public.project_specifications
  WHERE project_id = p_project_id;

  RETURN result;
END;
$function$;

-- Fix save_project_specification_with_token
CREATE OR REPLACE FUNCTION public.save_project_specification_with_token(
  p_project_id uuid,
  p_token uuid,
  p_generated_spec text,
  p_raw_data jsonb
)
RETURNS project_specifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.project_specifications;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.project_specifications (project_id, generated_spec, raw_data)
  VALUES (p_project_id, p_generated_spec, p_raw_data)
  ON CONFLICT (project_id) DO UPDATE
    SET generated_spec = EXCLUDED.generated_spec,
        raw_data = EXCLUDED.raw_data,
        updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix update_project_with_token
CREATE OR REPLACE FUNCTION public.update_project_with_token(
  p_project_id uuid,
  p_token uuid,
  p_name text,
  p_description text DEFAULT NULL::text,
  p_github_repo text DEFAULT NULL::text,
  p_organization text DEFAULT NULL::text,
  p_budget numeric DEFAULT NULL::numeric,
  p_scope text DEFAULT NULL::text,
  p_timeline_start date DEFAULT NULL::date,
  p_timeline_end date DEFAULT NULL::date,
  p_priority text DEFAULT NULL::text,
  p_tags text[] DEFAULT NULL::text[]
)
RETURNS projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.projects;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  UPDATE public.projects
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    github_repo = COALESCE(p_github_repo, github_repo),
    organization = COALESCE(p_organization, organization),
    budget = COALESCE(p_budget, budget),
    scope = COALESCE(p_scope, scope),
    timeline_start = COALESCE(p_timeline_start, timeline_start),
    timeline_end = COALESCE(p_timeline_end, timeline_end),
    priority = COALESCE(p_priority, priority),
    tags = COALESCE(p_tags, tags),
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Fix delete_project_with_token
CREATE OR REPLACE FUNCTION public.delete_project_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  -- Delete the project (cascading deletes will handle related records)
  DELETE FROM public.projects
  WHERE id = p_project_id;
END;
$function$;

-- Fix regenerate_share_token
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
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  -- Generate new token
  new_token := gen_random_uuid();

  -- Update project with new share token
  UPDATE public.projects
  SET share_token = new_token
  WHERE id = p_project_id;

  RETURN new_token;
END;
$function$;