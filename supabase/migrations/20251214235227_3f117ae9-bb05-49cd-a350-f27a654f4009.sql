-- Create helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'superadmin'
  )
$$;

-- Create helper function to check if user is admin or superadmin
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'superadmin')
  )
$$;

-- Create helper function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'superadmin' THEN 3
      WHEN 'admin' THEN 2
      WHEN 'user' THEN 1
      ELSE 0
    END DESC
  LIMIT 1
$$;

-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- New RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view admin roles"
ON public.user_roles
FOR SELECT
USING (
  is_admin_or_superadmin(auth.uid()) 
  AND role IN ('admin', 'superadmin')
);

CREATE POLICY "Superadmins can view all roles"
ON public.user_roles
FOR SELECT
USING (is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage non-superadmin roles"
ON public.user_roles
FOR ALL
USING (
  is_admin_or_superadmin(auth.uid())
  AND role != 'superadmin'
)
WITH CHECK (
  is_admin_or_superadmin(auth.uid())
  AND role != 'superadmin'
);

-- Drop existing policies on profiles that might conflict
DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view admin profiles"
ON public.profiles
FOR SELECT
USING (
  is_admin_or_superadmin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
    AND ur.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Superadmins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_superadmin(auth.uid()));

-- RPC function to get admin users (with profile data)
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  role text,
  last_login timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  v_caller_role := get_user_role(auth.uid());
  
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  IF v_caller_role = 'superadmin' THEN
    RETURN QUERY
    SELECT 
      p.user_id,
      p.email,
      p.display_name,
      COALESCE(get_user_role(p.user_id), 'user') as role,
      p.last_login,
      p.created_at
    FROM public.profiles p
    ORDER BY 
      CASE get_user_role(p.user_id)
        WHEN 'superadmin' THEN 1
        WHEN 'admin' THEN 2
        ELSE 3
      END,
      p.email;
  ELSE
    RETURN QUERY
    SELECT 
      p.user_id,
      p.email,
      p.display_name,
      ur.role::text as role,
      p.last_login,
      p.created_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role IN ('admin', 'superadmin')
    ORDER BY 
      CASE ur.role
        WHEN 'superadmin' THEN 1
        WHEN 'admin' THEN 2
        ELSE 3
      END,
      p.email;
  END IF;
END;
$$;

-- RPC function to set user role by email
CREATE OR REPLACE FUNCTION public.set_user_role_by_email(p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_user_id uuid;
  v_target_current_role text;
BEGIN
  IF p_role NOT IN ('user', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Only user or admin can be set.');
  END IF;
  
  v_caller_role := get_user_role(auth.uid());
  
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: Admin privileges required');
  END IF;
  
  SELECT user_id INTO v_target_user_id
  FROM public.profiles
  WHERE email = p_email;
  
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found with that email');
  END IF;
  
  v_target_current_role := get_user_role(v_target_user_id);
  
  IF v_target_current_role = 'superadmin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify superadmin roles');
  END IF;
  
  IF v_target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own role');
  END IF;
  
  DELETE FROM public.user_roles 
  WHERE user_id = v_target_user_id AND role != 'superadmin';
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_target_user_id, p_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN jsonb_build_object('success', true, 'message', 'Role updated successfully');
END;
$$;

-- RPC function to delete user account by email
CREATE OR REPLACE FUNCTION public.delete_user_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_user_id uuid;
  v_target_current_role text;
BEGIN
  v_caller_role := get_user_role(auth.uid());
  
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: Admin privileges required');
  END IF;
  
  SELECT user_id INTO v_target_user_id
  FROM public.profiles
  WHERE email = p_email;
  
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found with that email');
  END IF;
  
  v_target_current_role := get_user_role(v_target_user_id);
  
  IF v_target_current_role = 'superadmin' AND v_caller_role != 'superadmin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only superadmins can delete other superadmins');
  END IF;
  
  IF v_target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = v_target_user_id;
  DELETE FROM public.profiles WHERE user_id = v_target_user_id;
  
  RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id, 'message', 'User data deleted. Auth record pending deletion.');
END;
$$;