-- Add folder columns to artifacts table
ALTER TABLE public.artifacts 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.artifacts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_folder boolean NOT NULL DEFAULT false;

-- Create indexes for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_artifacts_parent_id ON public.artifacts(parent_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_project_folder ON public.artifacts(project_id, is_folder);

-- Add comments
COMMENT ON COLUMN public.artifacts.parent_id IS 'Parent artifact/folder ID for hierarchy. NULL = root level';
COMMENT ON COLUMN public.artifacts.is_folder IS 'True if this is a folder container, false for regular artifacts';

-- Create function to insert an artifact folder
CREATE OR REPLACE FUNCTION public.insert_artifact_folder_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT 'New Folder',
  p_parent_id uuid DEFAULT NULL
)
RETURNS public.artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result public.artifacts;
BEGIN
  -- Validate access - require at least editor role
  PERFORM public.require_role(p_project_id, p_token, 'editor');
  
  -- Insert folder artifact
  INSERT INTO public.artifacts (
    project_id,
    content,
    ai_title,
    is_folder,
    parent_id,
    created_by
  )
  VALUES (
    p_project_id,
    '',
    p_name,
    true,
    p_parent_id,
    auth.uid()
  )
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;

-- Create function to move an artifact to a different folder
CREATE OR REPLACE FUNCTION public.move_artifact_with_token(
  p_artifact_id uuid,
  p_token uuid DEFAULT NULL,
  p_new_parent_id uuid DEFAULT NULL  -- NULL = move to root
)
RETURNS public.artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.artifacts;
BEGIN
  -- Get project ID from artifact
  SELECT project_id INTO v_project_id FROM public.artifacts WHERE id = p_artifact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artifact not found';
  END IF;
  
  -- Validate access - require at least editor role
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Prevent circular reference (can't move folder into its own descendant)
  IF p_new_parent_id IS NOT NULL THEN
    -- Check that new parent exists and is a folder
    IF NOT EXISTS (
      SELECT 1 FROM public.artifacts 
      WHERE id = p_new_parent_id 
      AND project_id = v_project_id
      AND is_folder = true
    ) THEN
      RAISE EXCEPTION 'Target folder not found';
    END IF;
    
    -- Check for circular reference - new parent cannot be a descendant of the artifact
    IF EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT id FROM public.artifacts WHERE id = p_artifact_id
        UNION ALL
        SELECT a.id FROM public.artifacts a
        INNER JOIN descendants d ON a.parent_id = d.id
      )
      SELECT 1 FROM descendants WHERE id = p_new_parent_id
    ) THEN
      RAISE EXCEPTION 'Cannot move folder into its own descendant';
    END IF;
  END IF;
  
  -- Update artifact parent
  UPDATE public.artifacts
  SET parent_id = p_new_parent_id, updated_at = now()
  WHERE id = p_artifact_id
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;

-- Create function to rename an artifact folder
CREATE OR REPLACE FUNCTION public.rename_artifact_folder_with_token(
  p_artifact_id uuid,
  p_token uuid DEFAULT NULL,
  p_new_name text DEFAULT 'Untitled Folder'
)
RETURNS public.artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_project_id uuid;
  result public.artifacts;
BEGIN
  -- Get project ID from artifact
  SELECT project_id INTO v_project_id FROM public.artifacts WHERE id = p_artifact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artifact not found';
  END IF;
  
  -- Validate access - require at least editor role
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Update folder name
  UPDATE public.artifacts
  SET ai_title = p_new_name, updated_at = now()
  WHERE id = p_artifact_id
  RETURNING * INTO result;
  
  RETURN result;
END;
$function$;