-- Phase 4: Agent Context Integration
-- RPCs for agents to access project metadata, search requirements/standards, and review canvas

-- RPC: Get Project Metadata for Agent
CREATE OR REPLACE FUNCTION public.agent_get_project_metadata_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  organization TEXT,
  budget NUMERIC,
  scope TEXT,
  priority TEXT,
  status TEXT,
  timeline_start DATE,
  timeline_end DATE,
  selected_model TEXT,
  max_tokens INTEGER,
  thinking_enabled BOOLEAN,
  thinking_budget INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.description,
      p.organization,
      p.budget,
      p.scope,
      p.priority,
      p.status::TEXT,
      p.timeline_start,
      p.timeline_end,
      p.selected_model,
      p.max_tokens,
      p.thinking_enabled,
      p.thinking_budget
    FROM public.projects p
    WHERE p.id = p_project_id;
END;
$$;

-- RPC: Search Requirements by Keyword
CREATE OR REPLACE FUNCTION public.agent_search_requirements_with_token(
  p_project_id UUID,
  p_token UUID,
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  code TEXT,
  type TEXT,
  parent_id UUID,
  order_index INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  IF p_search_term IS NULL OR p_search_term = '' THEN
    RETURN QUERY
      SELECT 
        r.id,
        r.title,
        r.content,
        r.code,
        r.type::TEXT,
        r.parent_id,
        r.order_index
      FROM public.requirements r
      WHERE r.project_id = p_project_id
      ORDER BY r.order_index ASC;
  ELSE
    RETURN QUERY
      SELECT 
        r.id,
        r.title,
        r.content,
        r.code,
        r.type::TEXT,
        r.parent_id,
        r.order_index
      FROM public.requirements r
      WHERE r.project_id = p_project_id
        AND (
          r.title ILIKE '%' || p_search_term || '%'
          OR r.content ILIKE '%' || p_search_term || '%'
          OR r.code ILIKE '%' || p_search_term || '%'
        )
      ORDER BY r.order_index ASC;
  END IF;
END;
$$;

-- RPC: Search Standards by Keyword
CREATE OR REPLACE FUNCTION public.agent_search_standards_with_token(
  p_project_id UUID,
  p_token UUID,
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  content TEXT,
  code TEXT,
  category_id UUID,
  category_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  IF p_search_term IS NULL OR p_search_term = '' THEN
    RETURN QUERY
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.code,
        s.category_id,
        sc.name as category_name
      FROM public.project_standards ps
      JOIN public.standards s ON s.id = ps.standard_id
      JOIN public.standard_categories sc ON sc.id = s.category_id
      WHERE ps.project_id = p_project_id
      ORDER BY s.order_index ASC;
  ELSE
    RETURN QUERY
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.code,
        s.category_id,
        sc.name as category_name
      FROM public.project_standards ps
      JOIN public.standards s ON s.id = ps.standard_id
      JOIN public.standard_categories sc ON sc.id = s.category_id
      WHERE ps.project_id = p_project_id
        AND (
          s.title ILIKE '%' || p_search_term || '%'
          OR s.description ILIKE '%' || p_search_term || '%'
          OR s.content ILIKE '%' || p_search_term || '%'
          OR s.code ILIKE '%' || p_search_term || '%'
        )
      ORDER BY s.order_index ASC;
  END IF;
END;
$$;

-- RPC: Get Canvas Summary for Agent
CREATE OR REPLACE FUNCTION public.agent_get_canvas_summary_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS TABLE (
  nodes_count INTEGER,
  edges_count INTEGER,
  layers_count INTEGER,
  node_types JSONB,
  nodes JSONB,
  edges JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT 
      (SELECT COUNT(*)::INTEGER FROM public.canvas_nodes WHERE project_id = p_project_id),
      (SELECT COUNT(*)::INTEGER FROM public.canvas_edges WHERE project_id = p_project_id),
      (SELECT COUNT(*)::INTEGER FROM public.canvas_layers WHERE project_id = p_project_id),
      (
        SELECT JSONB_OBJECT_AGG(type::TEXT, count)
        FROM (
          SELECT type, COUNT(*)::INTEGER as count
          FROM public.canvas_nodes
          WHERE project_id = p_project_id
          GROUP BY type
        ) type_counts
      ),
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', n.id,
            'type', n.type,
            'data', n.data,
            'position', n.position
          )
        )
        FROM public.canvas_nodes n
        WHERE n.project_id = p_project_id
      ),
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', e.id,
            'source_id', e.source_id,
            'target_id', e.target_id,
            'edge_type', e.edge_type,
            'label', e.label
          )
        )
        FROM public.canvas_edges e
        WHERE e.project_id = p_project_id
      );
END;
$$;

-- RPC: Get Tech Stacks for Agent
CREATE OR REPLACE FUNCTION public.agent_get_tech_stacks_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type TEXT,
  parent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  RETURN QUERY
    SELECT 
      ts.id,
      ts.name,
      ts.description,
      ts.type,
      ts.parent_id
    FROM public.project_tech_stacks pts
    JOIN public.tech_stacks ts ON ts.id = pts.tech_stack_id
    WHERE pts.project_id = p_project_id
    ORDER BY ts.order_index ASC;
END;
$$;

-- RPC: Get Artifacts for Agent
CREATE OR REPLACE FUNCTION public.agent_get_artifacts_with_token(
  p_project_id UUID,
  p_token UUID,
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  ai_title TEXT,
  ai_summary TEXT,
  source_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);

  IF p_search_term IS NULL OR p_search_term = '' THEN
    RETURN QUERY
      SELECT 
        a.id,
        a.content,
        a.ai_title,
        a.ai_summary,
        a.source_type,
        a.created_at
      FROM public.artifacts a
      WHERE a.project_id = p_project_id
      ORDER BY a.created_at DESC;
  ELSE
    RETURN QUERY
      SELECT 
        a.id,
        a.content,
        a.ai_title,
        a.ai_summary,
        a.source_type,
        a.created_at
      FROM public.artifacts a
      WHERE a.project_id = p_project_id
        AND (
          a.content ILIKE '%' || p_search_term || '%'
          OR a.ai_title ILIKE '%' || p_search_term || '%'
          OR a.ai_summary ILIKE '%' || p_search_term || '%'
        )
      ORDER BY a.created_at DESC;
  END IF;
END;
$$;