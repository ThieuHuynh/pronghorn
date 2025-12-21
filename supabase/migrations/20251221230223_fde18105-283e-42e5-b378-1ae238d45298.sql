-- Drop existing overly permissive policies on organizations table
DROP POLICY IF EXISTS "Public can manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public can view organizations" ON public.organizations;

-- Create restrictive policies for organizations table
-- Only admins and superadmins can view organizations
CREATE POLICY "Admins can view organizations" 
ON public.organizations 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can insert organizations
CREATE POLICY "Superadmins can insert organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can update organizations
CREATE POLICY "Superadmins can update organizations" 
ON public.organizations 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can delete organizations
CREATE POLICY "Superadmins can delete organizations" 
ON public.organizations 
FOR DELETE 
USING (public.has_role(auth.uid(), 'superadmin'));