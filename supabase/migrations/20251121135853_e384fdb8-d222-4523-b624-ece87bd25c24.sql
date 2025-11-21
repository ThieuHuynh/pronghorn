-- Create canvas_layers table for grouping nodes
CREATE TABLE public.canvas_layers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  node_ids TEXT[] NOT NULL DEFAULT '{}',
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.canvas_layers ENABLE ROW LEVEL SECURITY;

-- RLS Policy for canvas_layers
CREATE POLICY "Users can access canvas layers"
ON public.canvas_layers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = canvas_layers.project_id
    AND (
      projects.created_by = auth.uid()
      OR projects.share_token = (current_setting('app.share_token', true))::uuid
    )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_layers;

-- RPC functions for layer CRUD with token validation
CREATE OR REPLACE FUNCTION public.get_canvas_layers_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS SETOF canvas_layers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);
  
  RETURN QUERY
    SELECT * FROM public.canvas_layers
    WHERE project_id = p_project_id
    ORDER BY created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_canvas_layer_with_token(
  p_id UUID,
  p_project_id UUID,
  p_token UUID,
  p_name TEXT,
  p_node_ids TEXT[],
  p_visible BOOLEAN
)
RETURNS canvas_layers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.canvas_layers;
BEGIN
  PERFORM public.set_share_token(p_token::text);
  
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
$$;

CREATE OR REPLACE FUNCTION public.delete_canvas_layer_with_token(
  p_id UUID,
  p_token UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_share_token(p_token::text);
  
  DELETE FROM public.canvas_layers
  WHERE id = p_id;
END;
$$;