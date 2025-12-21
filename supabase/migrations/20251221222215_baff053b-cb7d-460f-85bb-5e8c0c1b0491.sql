-- Create function to get published project content summary for preview
CREATE OR REPLACE FUNCTION public.get_published_project_content_summary(
  p_published_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_result jsonb;
BEGIN
  -- Get the source project_id from published_projects
  SELECT project_id INTO v_project_id
  FROM public.published_projects
  WHERE id = p_published_id AND is_visible = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published project not found or not visible';
  END IF;
  
  -- Increment view count
  UPDATE public.published_projects
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_published_id;
  
  -- Build the content summary
  SELECT jsonb_build_object(
    'requirements', (SELECT COUNT(*) FROM public.requirements WHERE project_id = v_project_id),
    'canvas_nodes', (SELECT COUNT(*) FROM public.canvas_nodes WHERE project_id = v_project_id),
    'canvas_edges', (SELECT COUNT(*) FROM public.canvas_edges WHERE project_id = v_project_id),
    'canvas_layers', (SELECT COUNT(*) FROM public.canvas_layers WHERE project_id = v_project_id),
    'chat_sessions', (SELECT COUNT(*) FROM public.chat_sessions WHERE project_id = v_project_id),
    'chat_messages', (SELECT COUNT(*) FROM public.chat_messages WHERE project_id = v_project_id),
    'artifacts', (SELECT COUNT(*) FROM public.artifacts WHERE project_id = v_project_id),
    'artifacts_with_images', (SELECT COUNT(*) FROM public.artifacts WHERE project_id = v_project_id AND image_url IS NOT NULL),
    'specifications', (SELECT COUNT(*) FROM public.project_specifications WHERE project_id = v_project_id),
    'standards', (SELECT COUNT(*) FROM public.project_standards WHERE project_id = v_project_id),
    'tech_stacks', (SELECT COUNT(*) FROM public.project_tech_stacks WHERE project_id = v_project_id),
    'repos', (SELECT COUNT(*) FROM public.project_repos WHERE project_id = v_project_id),
    'repo_files', (SELECT COUNT(*) FROM public.repo_files WHERE project_id = v_project_id),
    'databases', (SELECT COUNT(*) FROM public.project_databases WHERE project_id = v_project_id),
    'deployments', (SELECT COUNT(*) FROM public.project_deployments WHERE project_id = v_project_id)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Create function to clone a published project with options
CREATE OR REPLACE FUNCTION public.clone_published_project(
  p_published_id uuid,
  p_new_name text,
  p_clone_chat boolean DEFAULT false,
  p_clone_artifacts boolean DEFAULT false,
  p_clone_requirements boolean DEFAULT true,
  p_clone_standards boolean DEFAULT true,
  p_clone_specifications boolean DEFAULT false,
  p_clone_canvas boolean DEFAULT true,
  p_clone_repo_files boolean DEFAULT false,
  p_clone_databases boolean DEFAULT false,
  p_clone_tech_stacks boolean DEFAULT true
)
RETURNS TABLE(id uuid, share_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_project_id uuid;
  v_new_project_id uuid;
  v_new_token uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_source_project public.projects;
  v_new_repo_id uuid;
  v_source_repo_id uuid;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to clone projects';
  END IF;
  
  -- Get the source project from published_projects
  SELECT pp.project_id INTO v_source_project_id
  FROM public.published_projects pp
  WHERE pp.id = p_published_id AND pp.is_visible = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published project not found or not visible';
  END IF;
  
  -- Get source project details
  SELECT * INTO v_source_project FROM public.projects WHERE projects.id = v_source_project_id;
  
  -- Get or create org for user
  SELECT org_id INTO v_org_id FROM public.profiles WHERE user_id = v_user_id;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name) VALUES ('Personal') RETURNING organizations.id INTO v_org_id;
    UPDATE public.profiles SET org_id = v_org_id WHERE user_id = v_user_id;
  END IF;
  
  -- Create new project
  INSERT INTO public.projects (
    name, org_id, description, organization, budget, scope, status,
    priority, tags, created_by, splash_image_url
  )
  VALUES (
    p_new_name, v_org_id, v_source_project.description, v_source_project.organization,
    v_source_project.budget, v_source_project.scope, 'DESIGN',
    v_source_project.priority, v_source_project.tags, v_user_id, v_source_project.splash_image_url
  )
  RETURNING projects.id INTO v_new_project_id;
  
  -- Create owner token
  INSERT INTO public.project_tokens (project_id, role, label, created_by)
  VALUES (v_new_project_id, 'owner', 'Default Owner Token', v_user_id)
  RETURNING token INTO v_new_token;
  
  -- Clone requirements if requested
  IF p_clone_requirements THEN
    WITH RECURSIVE req_tree AS (
      SELECT id, parent_id, project_id, title, content, type, code, order_index
      FROM public.requirements
      WHERE project_id = v_source_project_id AND parent_id IS NULL
      UNION ALL
      SELECT r.id, r.parent_id, r.project_id, r.title, r.content, r.type, r.code, r.order_index
      FROM public.requirements r
      INNER JOIN req_tree rt ON r.parent_id = rt.id
    ),
    id_mapping AS (
      SELECT id AS old_id, gen_random_uuid() AS new_id FROM req_tree
    ),
    mapped_reqs AS (
      SELECT 
        im.new_id,
        (SELECT new_id FROM id_mapping WHERE old_id = rt.parent_id) AS new_parent_id,
        v_new_project_id AS project_id,
        rt.title, rt.content, rt.type, rt.code, rt.order_index
      FROM req_tree rt
      JOIN id_mapping im ON im.old_id = rt.id
    )
    INSERT INTO public.requirements (id, parent_id, project_id, title, content, type, code, order_index)
    SELECT new_id, new_parent_id, project_id, title, content, type, code, order_index FROM mapped_reqs;
  END IF;
  
  -- Clone standards if requested
  IF p_clone_standards THEN
    INSERT INTO public.project_standards (project_id, standard_id)
    SELECT v_new_project_id, standard_id FROM public.project_standards WHERE project_id = v_source_project_id;
  END IF;
  
  -- Clone tech stacks if requested
  IF p_clone_tech_stacks THEN
    INSERT INTO public.project_tech_stacks (project_id, tech_stack_id)
    SELECT v_new_project_id, tech_stack_id FROM public.project_tech_stacks WHERE project_id = v_source_project_id;
  END IF;
  
  -- Clone canvas if requested
  IF p_clone_canvas THEN
    WITH node_mapping AS (
      SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.canvas_nodes WHERE project_id = v_source_project_id
    )
    INSERT INTO public.canvas_nodes (id, project_id, type, position, data)
    SELECT nm.new_id, v_new_project_id, cn.type, cn.position, cn.data
    FROM public.canvas_nodes cn
    JOIN node_mapping nm ON nm.old_id = cn.id;
    
    WITH node_mapping AS (
      SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.canvas_nodes WHERE project_id = v_source_project_id
    )
    INSERT INTO public.canvas_edges (project_id, source_id, target_id, edge_type, label, style)
    SELECT v_new_project_id,
      (SELECT new_id FROM node_mapping WHERE old_id = ce.source_id),
      (SELECT new_id FROM node_mapping WHERE old_id = ce.target_id),
      ce.edge_type, ce.label, ce.style
    FROM public.canvas_edges ce
    WHERE ce.project_id = v_source_project_id;
    
    INSERT INTO public.canvas_layers (project_id, name, visible, node_ids)
    SELECT v_new_project_id, name, visible, node_ids FROM public.canvas_layers WHERE project_id = v_source_project_id;
  END IF;
  
  -- Clone specifications if requested
  IF p_clone_specifications THEN
    INSERT INTO public.project_specifications (project_id, agent_id, agent_title, version, is_latest, generated_spec, raw_data)
    SELECT v_new_project_id, agent_id, agent_title, version, is_latest, generated_spec, raw_data
    FROM public.project_specifications WHERE project_id = v_source_project_id;
  END IF;
  
  -- Clone chat sessions if requested
  IF p_clone_chat THEN
    WITH session_mapping AS (
      SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.chat_sessions WHERE project_id = v_source_project_id
    )
    INSERT INTO public.chat_sessions (id, project_id, title, ai_title, ai_summary, created_by)
    SELECT sm.new_id, v_new_project_id, cs.title, cs.ai_title, cs.ai_summary, v_user_id
    FROM public.chat_sessions cs
    JOIN session_mapping sm ON sm.old_id = cs.id;
    
    WITH session_mapping AS (
      SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.chat_sessions WHERE project_id = v_source_project_id
    )
    INSERT INTO public.chat_messages (project_id, chat_session_id, role, content, created_by)
    SELECT v_new_project_id, sm.new_id, cm.role, cm.content, v_user_id
    FROM public.chat_messages cm
    JOIN session_mapping sm ON sm.old_id = cm.chat_session_id;
  END IF;
  
  -- Clone artifacts if requested
  IF p_clone_artifacts THEN
    INSERT INTO public.artifacts (project_id, content, ai_title, ai_summary, source_type, source_id, image_url, created_by)
    SELECT v_new_project_id, content, ai_title, ai_summary, source_type, source_id, image_url, v_user_id
    FROM public.artifacts WHERE project_id = v_source_project_id;
  END IF;
  
  -- Clone repo files if requested
  IF p_clone_repo_files THEN
    SELECT id INTO v_source_repo_id FROM public.project_repos WHERE project_id = v_source_project_id AND is_default = true LIMIT 1;
    
    IF v_source_repo_id IS NOT NULL THEN
      INSERT INTO public.project_repos (project_id, organization, repo, branch, is_default, is_prime)
      VALUES (v_new_project_id, 'cloned', p_new_name, 'main', true, true)
      RETURNING project_repos.id INTO v_new_repo_id;
      
      INSERT INTO public.repo_files (project_id, repo_id, path, content, is_binary, last_commit_sha)
      SELECT v_new_project_id, v_new_repo_id, path, content, is_binary, last_commit_sha
      FROM public.repo_files WHERE repo_id = v_source_repo_id;
    END IF;
  END IF;
  
  -- Increment clone count on published project
  UPDATE public.published_projects
  SET clone_count = COALESCE(clone_count, 0) + 1
  WHERE published_projects.id = p_published_id;
  
  RETURN QUERY SELECT v_new_project_id AS id, v_new_token AS share_token;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_published_project_content_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_published_project(uuid, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated;