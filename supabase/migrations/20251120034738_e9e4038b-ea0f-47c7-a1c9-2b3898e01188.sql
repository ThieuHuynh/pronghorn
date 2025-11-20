-- Create project_specifications table
CREATE TABLE IF NOT EXISTS public.project_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_spec TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_specifications ENABLE ROW LEVEL SECURITY;

-- RLS policy for project specifications
CREATE POLICY "Users can access project specifications"
  ON public.project_specifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_specifications.project_id
        AND (projects.created_by = auth.uid() OR projects.share_token = (current_setting('app.share_token', true))::uuid)
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_project_specifications_updated_at
  BEFORE UPDATE ON public.project_specifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC function to save specification with token
CREATE OR REPLACE FUNCTION public.save_project_specification_with_token(
  p_project_id UUID,
  p_token UUID,
  p_generated_spec TEXT,
  p_raw_data JSONB
)
RETURNS project_specifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result public.project_specifications;
BEGIN
  PERFORM public.set_share_token(p_token::text);

  INSERT INTO public.project_specifications (project_id, generated_spec, raw_data)
  VALUES (p_project_id, p_generated_spec, p_raw_data)
  ON CONFLICT (project_id) DO UPDATE
    SET generated_spec = EXCLUDED.generated_spec,
        raw_data = EXCLUDED.raw_data,
        updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Add unique constraint so we only have one spec per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_specifications_project_id 
  ON public.project_specifications(project_id);

-- RPC function to get specification with token
CREATE OR REPLACE FUNCTION public.get_project_specification_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS project_specifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result public.project_specifications;
BEGIN
  PERFORM public.set_share_token(p_token::text);

  SELECT *
  INTO result
  FROM public.project_specifications
  WHERE project_id = p_project_id;

  RETURN result;
END;
$$;