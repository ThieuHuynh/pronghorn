-- Phase 7: Remove legacy share_token and allow owner tokens
-- STEP 1: Drop ALL existing policies that depend on share_token FIRST

-- projects table policies
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can update their projects" ON public.projects;

-- All child table policies
DROP POLICY IF EXISTS "Users can access canvas nodes" ON public.canvas_nodes;
DROP POLICY IF EXISTS "Users can access canvas edges" ON public.canvas_edges;
DROP POLICY IF EXISTS "Users can access canvas layers" ON public.canvas_layers;
DROP POLICY IF EXISTS "Users can access requirements" ON public.requirements;
DROP POLICY IF EXISTS "Users can access artifacts" ON public.artifacts;
DROP POLICY IF EXISTS "Users can access chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can access chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can access project repos" ON public.project_repos;
DROP POLICY IF EXISTS "Users can access repo files" ON public.repo_files;
DROP POLICY IF EXISTS "Users can access repo staging" ON public.repo_staging;
DROP POLICY IF EXISTS "Users can view repo commits" ON public.repo_commits;
DROP POLICY IF EXISTS "Users can insert repo commits" ON public.repo_commits;
DROP POLICY IF EXISTS "Users can access project standards" ON public.project_standards;
DROP POLICY IF EXISTS "Users can access project tech stacks" ON public.project_tech_stacks;
DROP POLICY IF EXISTS "Users can access project specifications" ON public.project_specifications;
DROP POLICY IF EXISTS "Users can access activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can access audit runs" ON public.audit_runs;
DROP POLICY IF EXISTS "Users can access audit findings" ON public.audit_findings;
DROP POLICY IF EXISTS "Users can access build sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can access agent_sessions via token or auth" ON public.agent_sessions;
DROP POLICY IF EXISTS "Users can access agent_messages via token or auth" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can access agent_file_operations via token or auth" ON public.agent_file_operations;
DROP POLICY IF EXISTS "Users can access agent_blackboard via token or auth" ON public.agent_blackboard;
DROP POLICY IF EXISTS "Users can access agent_session_context via token or auth" ON public.agent_session_context;
DROP POLICY IF EXISTS "Users can access requirement standards" ON public.requirement_standards;

-- STEP 2: Now drop the share_token column
ALTER TABLE public.projects DROP COLUMN IF EXISTS share_token;

-- STEP 3: Update create_project_token_with_token to allow ALL roles including owner
CREATE OR REPLACE FUNCTION public.create_project_token_with_token(
  p_project_id uuid,
  p_token uuid,
  p_role project_token_role,
  p_label text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS project_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_token public.project_tokens;
BEGIN
  -- Require owner role to create tokens
  PERFORM public.require_role(p_project_id, p_token, 'owner');
  
  -- Allow creating any role (owner, editor, viewer)
  INSERT INTO public.project_tokens (project_id, token, role, label, expires_at, created_by)
  VALUES (p_project_id, gen_random_uuid(), p_role, p_label, p_expires_at, auth.uid())
  RETURNING * INTO new_token;
  
  RETURN new_token;
END;
$function$;

-- STEP 4: Update authorize_project_access to remove legacy share_token fallback
CREATE OR REPLACE FUNCTION public.authorize_project_access(p_project_id uuid, p_token uuid DEFAULT NULL)
RETURNS project_token_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role project_token_role;
  v_created_by uuid;
BEGIN
  -- Check 1: If authenticated user owns the project, they have owner role
  SELECT created_by INTO v_created_by
  FROM public.projects
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  
  IF auth.uid() IS NOT NULL AND v_created_by = auth.uid() THEN
    RETURN 'owner'::project_token_role;
  END IF;
  
  -- Check 2: Valid token in project_tokens table
  IF p_token IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.project_tokens
    WHERE project_id = p_project_id
      AND token = p_token
      AND (expires_at IS NULL OR expires_at > now());
    
    IF FOUND THEN
      -- Update last_used_at
      UPDATE public.project_tokens
      SET last_used_at = now()
      WHERE project_id = p_project_id AND token = p_token;
      
      RETURN v_role;
    END IF;
  END IF;
  
  -- No valid access
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Share token is required';
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$function$;

-- STEP 5: Create new RLS policies using project_tokens table

-- projects table
CREATE POLICY "Users can view projects" ON public.projects
FOR SELECT USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.project_tokens pt
    WHERE pt.project_id = projects.id
      AND pt.token = (current_setting('app.share_token', true))::uuid
      AND (pt.expires_at IS NULL OR pt.expires_at > now())
  )
);

CREATE POLICY "Project owners can update their projects" ON public.projects
FOR UPDATE USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.project_tokens pt
    WHERE pt.project_id = projects.id
      AND pt.token = (current_setting('app.share_token', true))::uuid
      AND pt.role IN ('owner', 'editor')
      AND (pt.expires_at IS NULL OR pt.expires_at > now())
  )
);

-- canvas_nodes
CREATE POLICY "Users can access canvas nodes" ON public.canvas_nodes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = canvas_nodes.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- canvas_edges
CREATE POLICY "Users can access canvas edges" ON public.canvas_edges
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = canvas_edges.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- canvas_layers
CREATE POLICY "Users can access canvas layers" ON public.canvas_layers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = canvas_layers.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- requirements
CREATE POLICY "Users can access requirements" ON public.requirements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = requirements.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- artifacts
CREATE POLICY "Users can access artifacts" ON public.artifacts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = artifacts.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- chat_sessions
CREATE POLICY "Users can access chat sessions" ON public.chat_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = chat_sessions.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- chat_messages
CREATE POLICY "Users can access chat messages" ON public.chat_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    JOIN public.projects p ON p.id = cs.project_id
    WHERE cs.id = chat_messages.chat_session_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- project_repos
CREATE POLICY "Users can access project repos" ON public.project_repos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_repos.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- repo_files
CREATE POLICY "Users can access repo files" ON public.repo_files
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = repo_files.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- repo_staging
CREATE POLICY "Users can access repo staging" ON public.repo_staging
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = repo_staging.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- repo_commits
CREATE POLICY "Users can view repo commits" ON public.repo_commits
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = repo_commits.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

CREATE POLICY "Users can insert repo commits" ON public.repo_commits
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = repo_commits.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- project_standards
CREATE POLICY "Users can access project standards" ON public.project_standards
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_standards.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- project_tech_stacks
CREATE POLICY "Users can access project tech stacks" ON public.project_tech_stacks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tech_stacks.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- project_specifications
CREATE POLICY "Users can access project specifications" ON public.project_specifications
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_specifications.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- activity_logs
CREATE POLICY "Users can access activity logs" ON public.activity_logs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = activity_logs.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- audit_runs
CREATE POLICY "Users can access audit runs" ON public.audit_runs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = audit_runs.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- audit_findings
CREATE POLICY "Users can access audit findings" ON public.audit_findings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.audit_runs ar
    JOIN public.projects p ON p.id = ar.project_id
    WHERE ar.id = audit_findings.audit_run_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- build_sessions
CREATE POLICY "Users can access build sessions" ON public.build_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = build_sessions.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- agent_sessions
CREATE POLICY "Users can access agent_sessions via token or auth" ON public.agent_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = agent_sessions.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- agent_messages
CREATE POLICY "Users can access agent_messages via token or auth" ON public.agent_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.agent_sessions ags
    JOIN public.projects p ON p.id = ags.project_id
    WHERE ags.id = agent_messages.session_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- agent_file_operations
CREATE POLICY "Users can access agent_file_operations via token or auth" ON public.agent_file_operations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.agent_sessions ags
    JOIN public.projects p ON p.id = ags.project_id
    WHERE ags.id = agent_file_operations.session_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- agent_blackboard
CREATE POLICY "Users can access agent_blackboard via token or auth" ON public.agent_blackboard
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.agent_sessions ags
    JOIN public.projects p ON p.id = ags.project_id
    WHERE ags.id = agent_blackboard.session_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- agent_session_context
CREATE POLICY "Users can access agent_session_context via token or auth" ON public.agent_session_context
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.agent_sessions ags
    JOIN public.projects p ON p.id = ags.project_id
    WHERE ags.id = agent_session_context.session_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);

-- requirement_standards
CREATE POLICY "Users can access requirement standards" ON public.requirement_standards
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.requirements r
    JOIN public.projects p ON p.id = r.project_id
    WHERE r.id = requirement_standards.requirement_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_tokens pt
          WHERE pt.project_id = p.id
            AND pt.token = (current_setting('app.share_token', true))::uuid
            AND (pt.expires_at IS NULL OR pt.expires_at > now())
        )
      )
  )
);