-- Add provenance tracking columns to artifacts table
ALTER TABLE public.artifacts 
ADD COLUMN IF NOT EXISTS provenance_id text,
ADD COLUMN IF NOT EXISTS provenance_path text,
ADD COLUMN IF NOT EXISTS provenance_page integer,
ADD COLUMN IF NOT EXISTS provenance_total_pages integer;

-- Create index for efficient provenance lookups
CREATE INDEX IF NOT EXISTS idx_artifacts_provenance_id ON public.artifacts(provenance_id) WHERE provenance_id IS NOT NULL;

-- Add comments to document the columns
COMMENT ON COLUMN public.artifacts.provenance_id IS 'Unique identifier linking related artifacts from the same source document';
COMMENT ON COLUMN public.artifacts.provenance_path IS 'Original filename or path of the source document';
COMMENT ON COLUMN public.artifacts.provenance_page IS 'Page/slide number within the source document';
COMMENT ON COLUMN public.artifacts.provenance_total_pages IS 'Total pages/slides in the source document';

-- Update the insert_artifact_with_token function to accept provenance parameters
CREATE OR REPLACE FUNCTION public.insert_artifact_with_token(
  p_project_id uuid,
  p_token uuid,
  p_content text,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_provenance_id text DEFAULT NULL,
  p_provenance_path text DEFAULT NULL,
  p_provenance_page integer DEFAULT NULL,
  p_provenance_total_pages integer DEFAULT NULL
)
RETURNS public.artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result public.artifacts;
BEGIN
  -- Validate access - require at least editor role
  PERFORM public.require_role(p_project_id, p_token, 'editor');

  INSERT INTO public.artifacts (
    project_id,
    content,
    source_type,
    source_id,
    image_url,
    provenance_id,
    provenance_path,
    provenance_page,
    provenance_total_pages
  )
  VALUES (
    p_project_id,
    p_content,
    p_source_type,
    p_source_id,
    p_image_url,
    p_provenance_id,
    p_provenance_path,
    p_provenance_page,
    p_provenance_total_pages
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;