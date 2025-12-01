-- RPC: Get project repos with token validation
CREATE OR REPLACE FUNCTION public.get_project_repos_with_token(
  p_project_id UUID,
  p_token UUID
)
RETURNS SETOF project_repos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  RETURN QUERY
    SELECT *
    FROM public.project_repos
    WHERE project_id = p_project_id
    ORDER BY is_default DESC, created_at ASC;
END;
$$;

-- RPC: Create project repo with token validation
CREATE OR REPLACE FUNCTION public.create_project_repo_with_token(
  p_project_id UUID,
  p_token UUID,
  p_organization TEXT,
  p_repo TEXT,
  p_branch TEXT DEFAULT 'main',
  p_is_default BOOLEAN DEFAULT false
)
RETURNS project_repos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_repo public.project_repos;
BEGIN
  -- Validate access first
  PERFORM public.validate_project_access(p_project_id, p_token);

  INSERT INTO public.project_repos (
    project_id,
    organization,
    repo,
    branch,
    is_default
  )
  VALUES (
    p_project_id,
    p_organization,
    p_repo,
    p_branch,
    p_is_default
  )
  RETURNING * INTO new_repo;

  RETURN new_repo;
END;
$$;

-- RPC: Delete project repo with token validation
CREATE OR REPLACE FUNCTION public.delete_project_repo_with_token(
  p_repo_id UUID,
  p_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  v_is_default BOOLEAN;
BEGIN
  -- Get project_id and is_default from repo
  SELECT project_id, is_default INTO v_project_id, v_is_default
  FROM public.project_repos
  WHERE id = p_repo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repository not found' USING ERRCODE = 'P0001';
  END IF;

  -- Prevent deletion of default repo
  IF v_is_default THEN
    RAISE EXCEPTION 'Cannot delete default repository' USING ERRCODE = 'P0001';
  END IF;

  -- Validate access
  PERFORM public.validate_project_access(v_project_id, p_token);

  -- Delete repo (cascade deletes PATs and files)
  DELETE FROM public.project_repos
  WHERE id = p_repo_id;
END;
$$;

-- RPC: Insert PAT for repo (user must be authenticated)
CREATE OR REPLACE FUNCTION public.insert_repo_pat_with_token(
  p_repo_id UUID,
  p_pat TEXT
)
RETURNS repo_pats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
  new_pat public.repo_pats;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  -- Get project_id from repo
  SELECT project_id INTO v_project_id
  FROM public.project_repos
  WHERE id = p_repo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repository not found' USING ERRCODE = 'P0001';
  END IF;

  -- Insert PAT (RLS ensures user owns it)
  INSERT INTO public.repo_pats (user_id, repo_id, pat)
  VALUES (v_user_id, p_repo_id, p_pat)
  ON CONFLICT (user_id, repo_id) DO UPDATE
    SET pat = EXCLUDED.pat
  RETURNING * INTO new_pat;

  RETURN new_pat;
END;
$$;

-- RPC: Delete PAT for repo (user must be authenticated and own the PAT)
CREATE OR REPLACE FUNCTION public.delete_repo_pat_with_token(
  p_repo_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  -- Delete PAT (RLS ensures user owns it)
  DELETE FROM public.repo_pats
  WHERE repo_id = p_repo_id
    AND user_id = v_user_id;
END;
$$;