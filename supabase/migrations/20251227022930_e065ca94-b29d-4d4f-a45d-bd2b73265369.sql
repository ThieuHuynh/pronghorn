-- Fix type mismatch: x_element_id should be cast to uuid

CREATE OR REPLACE FUNCTION public.insert_audit_tesseract_cells_batch_with_token(
  p_session_id uuid,
  p_token uuid,
  p_cells jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_inserted_count integer;
BEGIN
  -- Get project_id from session
  SELECT project_id INTO v_project_id FROM public.audit_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  
  -- Validate access (require editor role)
  PERFORM public.require_role(v_project_id, p_token, 'editor');
  
  -- Insert cells from JSONB array
  INSERT INTO public.audit_tesseract_cells (
    id, session_id, x_index, x_element_id, x_element_type, x_element_label,
    y_step, y_step_label, z_polarity, z_criticality, evidence_summary, evidence_refs, contributing_agents
  )
  SELECT 
    COALESCE((c->>'id')::uuid, gen_random_uuid()),
    p_session_id,
    COALESCE((c->>'x_index')::integer, 0),
    -- Cast x_element_id to uuid properly
    COALESCE((c->>'x_element_id')::uuid, gen_random_uuid()),
    COALESCE(c->>'x_element_type', 'concept'),
    c->>'x_element_label',
    COALESCE((c->>'y_step')::integer, 0),
    c->>'y_step_label',
    COALESCE((c->>'z_polarity')::numeric, 0),
    c->>'z_criticality',
    c->>'evidence_summary',
    c->'evidence_refs',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(c->'contributing_agents')), ARRAY['pipeline']::text[])
  FROM jsonb_array_elements(p_cells) AS c
  ON CONFLICT (id) DO UPDATE SET
    z_polarity = EXCLUDED.z_polarity,
    evidence_summary = EXCLUDED.evidence_summary,
    updated_at = now();
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$function$;