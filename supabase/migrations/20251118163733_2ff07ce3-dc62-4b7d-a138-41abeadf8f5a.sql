-- Functions to support share-token-based access for requirements and canvas data

-- 1) Requirements: select with token
CREATE OR REPLACE FUNCTION public.get_requirements_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF public.requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set share token for this session so RLS policies can validate access
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT *
    FROM public.requirements
    WHERE project_id = p_project_id
    ORDER BY order_index ASC;
END;
$$;

-- 2) Requirements: insert with token
CREATE OR REPLACE FUNCTION public.insert_requirement_with_token(
  p_project_id uuid,
  p_token uuid,
  p_parent_id uuid,
  p_type public.requirement_type,
  p_title text
)
RETURNS public.requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_req public.requirements;
BEGIN
  PERFORM public.set_share_token(p_token::text);

  INSERT INTO public.requirements (project_id, parent_id, type, title)
  VALUES (p_project_id, p_parent_id, p_type, p_title)
  RETURNING * INTO new_req;

  RETURN new_req;
END;
$$;

-- 3) Requirements: update with token
CREATE OR REPLACE FUNCTION public.update_requirement_with_token(
  p_id uuid,
  p_token uuid,
  p_title text,
  p_content text
)
RETURNS public.requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.requirements;
BEGIN
  PERFORM public.set_share_token(p_token::text);

  UPDATE public.requirements
  SET
    title = COALESCE(p_title, title),
    content = p_content,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

-- 4) Requirements: delete with token
CREATE OR REPLACE FUNCTION public.delete_requirement_with_token(
  p_id uuid,
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  DELETE FROM public.requirements
  WHERE id = p_id;
END;
$$;

-- 5) Canvas nodes: select with token
CREATE OR REPLACE FUNCTION public.get_canvas_nodes_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF public.canvas_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT *
    FROM public.canvas_nodes
    WHERE project_id = p_project_id;
END;
$$;

-- 6) Canvas edges: select with token
CREATE OR REPLACE FUNCTION public.get_canvas_edges_with_token(
  p_project_id uuid,
  p_token uuid
)
RETURNS SETOF public.canvas_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT *
    FROM public.canvas_edges
    WHERE project_id = p_project_id;
END;
$$;

-- 7) Canvas nodes: upsert with token
CREATE OR REPLACE FUNCTION public.upsert_canvas_node_with_token(
  p_id uuid,
  p_project_id uuid,
  p_token uuid,
  p_type public.node_type,
  p_position jsonb,
  p_data jsonb
)
RETURNS public.canvas_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.canvas_nodes;
BEGIN
  PERFORM public.set_share_token(p_token::text);

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
$$;

-- 8) Canvas edges: upsert with token
CREATE OR REPLACE FUNCTION public.upsert_canvas_edge_with_token(
  p_id uuid,
  p_project_id uuid,
  p_token uuid,
  p_source_id uuid,
  p_target_id uuid,
  p_label text
)
RETURNS public.canvas_edges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.canvas_edges;
BEGIN
  PERFORM public.set_share_token(p_token::text);

  INSERT INTO public.canvas_edges (id, project_id, source_id, target_id, label)
  VALUES (p_id, p_project_id, p_source_id, p_target_id, p_label)
  ON CONFLICT (id) DO UPDATE
    SET
      source_id = EXCLUDED.source_id,
      target_id = EXCLUDED.target_id,
      label = EXCLUDED.label
  RETURNING * INTO result;

  RETURN result;
END;
$$;