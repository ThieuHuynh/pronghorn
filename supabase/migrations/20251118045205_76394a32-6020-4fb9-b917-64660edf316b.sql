-- Fix SELECT policy to allow anonymous users to view projects they create
-- and allow share token access

DROP POLICY IF EXISTS "Users can view their own projects" ON projects;

CREATE POLICY "Users can view projects" 
  ON projects 
  FOR SELECT 
  TO authenticated, anon
  USING (
    (auth.uid() = created_by) 
    OR (share_token = (current_setting('app.share_token', true))::uuid)
    OR (created_by IS NULL AND auth.uid() IS NULL)
  );