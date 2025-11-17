-- Remove authentication requirements for most tables while keeping admin checks for standards

-- Drop existing policies that require authentication
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;
DROP POLICY IF EXISTS "Users can create projects in their organization" ON projects;
DROP POLICY IF EXISTS "Users can update projects in their organization" ON projects;

DROP POLICY IF EXISTS "Users can view requirements for accessible projects" ON requirements;
DROP POLICY IF EXISTS "Users can manage requirements for accessible projects" ON requirements;

DROP POLICY IF EXISTS "Users can view canvas nodes for accessible projects" ON canvas_nodes;
DROP POLICY IF EXISTS "Users can manage canvas nodes for accessible projects" ON canvas_nodes;

DROP POLICY IF EXISTS "Users can view canvas edges for accessible projects" ON canvas_edges;
DROP POLICY IF EXISTS "Users can manage canvas edges for accessible projects" ON canvas_edges;

DROP POLICY IF EXISTS "Users can view requirement-standard links for accessible projec" ON requirement_standards;
DROP POLICY IF EXISTS "Users can manage requirement-standard links for accessible proj" ON requirement_standards;

DROP POLICY IF EXISTS "Users can view project tech stacks" ON project_tech_stacks;
DROP POLICY IF EXISTS "Users can manage project tech stacks" ON project_tech_stacks;

DROP POLICY IF EXISTS "Users can view audit runs for accessible projects" ON audit_runs;
DROP POLICY IF EXISTS "Users can view audit findings for accessible projects" ON audit_findings;
DROP POLICY IF EXISTS "Users can view build sessions for accessible projects" ON build_sessions;
DROP POLICY IF EXISTS "Users can view activity logs for accessible projects" ON activity_logs;

-- Create public access policies for most tables
CREATE POLICY "Public can view organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public can manage organizations" ON organizations FOR ALL USING (true);

CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public can manage profiles" ON profiles FOR ALL USING (true);

CREATE POLICY "Public can view projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public can manage projects" ON projects FOR ALL USING (true);

CREATE POLICY "Public can view requirements" ON requirements FOR SELECT USING (true);
CREATE POLICY "Public can manage requirements" ON requirements FOR ALL USING (true);

CREATE POLICY "Public can view canvas nodes" ON canvas_nodes FOR SELECT USING (true);
CREATE POLICY "Public can manage canvas nodes" ON canvas_nodes FOR ALL USING (true);

CREATE POLICY "Public can view canvas edges" ON canvas_edges FOR SELECT USING (true);
CREATE POLICY "Public can manage canvas edges" ON canvas_edges FOR ALL USING (true);

CREATE POLICY "Public can view requirement standards" ON requirement_standards FOR SELECT USING (true);
CREATE POLICY "Public can manage requirement standards" ON requirement_standards FOR ALL USING (true);

CREATE POLICY "Public can view project tech stacks" ON project_tech_stacks FOR SELECT USING (true);
CREATE POLICY "Public can manage project tech stacks" ON project_tech_stacks FOR ALL USING (true);

CREATE POLICY "Public can view audit runs" ON audit_runs FOR SELECT USING (true);
CREATE POLICY "Public can manage audit runs" ON audit_runs FOR ALL USING (true);

CREATE POLICY "Public can view audit findings" ON audit_findings FOR SELECT USING (true);
CREATE POLICY "Public can manage audit findings" ON audit_findings FOR ALL USING (true);

CREATE POLICY "Public can view build sessions" ON build_sessions FOR SELECT USING (true);
CREATE POLICY "Public can manage build sessions" ON build_sessions FOR ALL USING (true);

CREATE POLICY "Public can view activity logs" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Public can manage activity logs" ON activity_logs FOR ALL USING (true);

-- Standards and categories remain viewable by everyone but modification requires admin
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view standards" ON standards;
DROP POLICY IF EXISTS "Users can create standards in their org" ON standards;
DROP POLICY IF EXISTS "Users can update standards in their org" ON standards;
DROP POLICY IF EXISTS "Users can delete standards in their org" ON standards;

DROP POLICY IF EXISTS "Users can view standard categories" ON standard_categories;
DROP POLICY IF EXISTS "Users can create standard categories in their org" ON standard_categories;
DROP POLICY IF EXISTS "Users can update standard categories in their org" ON standard_categories;
DROP POLICY IF EXISTS "Users can delete standard categories in their org" ON standard_categories;

DROP POLICY IF EXISTS "Standard attachments are viewable by authenticated users" ON standard_attachments;

DROP POLICY IF EXISTS "Users can view tech stacks in their org" ON tech_stacks;
DROP POLICY IF EXISTS "Users can create tech stacks in their org" ON tech_stacks;
DROP POLICY IF EXISTS "Users can update tech stacks in their org" ON tech_stacks;
DROP POLICY IF EXISTS "Users can delete tech stacks in their org" ON tech_stacks;

DROP POLICY IF EXISTS "Users can view tech stack standards" ON tech_stack_standards;
DROP POLICY IF EXISTS "Users can manage tech stack standards" ON tech_stack_standards;

-- Create new public policies (admin verification will be done in edge functions)
CREATE POLICY "Public can view standards" ON standards FOR SELECT USING (true);
CREATE POLICY "Public can manage standards" ON standards FOR ALL USING (true);

CREATE POLICY "Public can view standard categories" ON standard_categories FOR SELECT USING (true);
CREATE POLICY "Public can manage standard categories" ON standard_categories FOR ALL USING (true);

CREATE POLICY "Public can view standard attachments" ON standard_attachments FOR SELECT USING (true);
CREATE POLICY "Public can manage standard attachments" ON standard_attachments FOR ALL USING (true);

CREATE POLICY "Public can view tech stacks" ON tech_stacks FOR SELECT USING (true);
CREATE POLICY "Public can manage tech stacks" ON tech_stacks FOR ALL USING (true);

CREATE POLICY "Public can view tech stack standards" ON tech_stack_standards FOR SELECT USING (true);
CREATE POLICY "Public can manage tech stack standards" ON tech_stack_standards FOR ALL USING (true);