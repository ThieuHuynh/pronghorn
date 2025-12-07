-- Phase 1: Create canvas_node_types table for dynamic node configuration
CREATE TABLE public.canvas_node_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL UNIQUE,
  display_label text NOT NULL,
  description text,
  icon text NOT NULL,
  emoji text,
  color_class text NOT NULL,
  order_score integer NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_legacy boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.canvas_node_types ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view node types" ON public.canvas_node_types
  FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can manage node types" ON public.canvas_node_types
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_canvas_node_types_updated_at
  BEFORE UPDATE ON public.canvas_node_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with all node types (legacy + new)
INSERT INTO public.canvas_node_types (system_name, display_label, description, icon, emoji, color_class, order_score, category, is_legacy) VALUES
-- Meta types (leftmost)
('PROJECT', 'Project', 'Root application node', 'FolderKanban', '🎯', 'bg-cyan-500/10 border-cyan-500/50 text-cyan-700 dark:text-cyan-400', 100, 'meta', false),
('REQUIREMENT', 'Requirement', 'Functional requirement', 'FileText', '📋', 'bg-indigo-500/10 border-indigo-500/50 text-indigo-700 dark:text-indigo-400', 100, 'meta', false),
('STANDARD', 'Standard', 'Compliance standard', 'ListChecks', '📏', 'bg-teal-500/10 border-teal-500/50 text-teal-700 dark:text-teal-400', 100, 'meta', false),
('TECH_STACK', 'Tech Stack', 'Technology choice', 'Code', '🔧', 'bg-gray-500/10 border-gray-500/50 text-gray-700 dark:text-gray-400', 100, 'meta', false),
('SECURITY', 'Security', 'Security control', 'ShieldCheck', '🔒', 'bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400', 100, 'infrastructure', false),

-- Frontend types
('PAGE', 'Page', 'User-facing page/route', 'FileCode', '📄', 'bg-sky-500/10 border-sky-500/50 text-sky-700 dark:text-sky-400', 200, 'frontend', false),
('WEB_COMPONENT', 'Web Component', 'Frontend UI component', 'Box', '⚛️', 'bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400', 300, 'frontend', false),
('COMPONENT', 'Component', 'Legacy: UI component', 'Box', '⚛️', 'bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400', 300, 'frontend', true),
('HOOK_COMPOSABLE', 'Hook/Composable', 'Frontend hook or composable', 'Layers', '🪝', 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-400', 400, 'frontend', false),

-- API types
('API_SERVICE', 'API Service', 'API service entry point', 'Server', '🌐', 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400', 500, 'backend', false),
('API_ROUTER', 'API Router', 'API routing layer', 'GitBranch', '🔀', 'bg-lime-500/10 border-lime-500/50 text-lime-700 dark:text-lime-400', 600, 'backend', false),
('API_MIDDLEWARE', 'API Middleware', 'API middleware handler', 'Filter', '⚙️', 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-400', 600, 'backend', false),
('API', 'API', 'Legacy: API endpoint', 'Code', '🔌', 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400', 600, 'backend', true),
('API_CONTROLLER', 'API Controller', 'API controller logic', 'Cpu', '🎮', 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-400', 700, 'backend', false),
('API_UTIL', 'API Utility', 'API utility functions', 'Wrench', '🔨', 'bg-stone-500/10 border-stone-500/50 text-stone-700 dark:text-stone-400', 700, 'backend', false),
('WEBHOOK', 'Webhook', 'Webhook handler', 'Webhook', '📡', 'bg-pink-500/10 border-pink-500/50 text-pink-700 dark:text-pink-400', 700, 'backend', false),

-- Infrastructure types
('EXTERNAL_SERVICE', 'External Service', 'Third-party service integration', 'Globe', '🌍', 'bg-orange-500/10 border-orange-500/50 text-orange-700 dark:text-orange-400', 800, 'infrastructure', false),
('SERVICE', 'Service', 'Legacy: External service', 'Globe', '⚙️', 'bg-orange-500/10 border-orange-500/50 text-orange-700 dark:text-orange-400', 800, 'infrastructure', true),
('FIREWALL', 'Firewall', 'Firewall/security layer', 'Shield', '🛡️', 'bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400', 800, 'infrastructure', false),

-- Database types
('DATABASE', 'Database', 'Database container', 'Database', '🗄️', 'bg-purple-500/10 border-purple-500/50 text-purple-700 dark:text-purple-400', 900, 'database', false),
('SCHEMA', 'Schema', 'Database schema', 'TableProperties', '📊', 'bg-fuchsia-500/10 border-fuchsia-500/50 text-fuchsia-700 dark:text-fuchsia-400', 950, 'database', false),
('TABLE', 'Table', 'Database table', 'Table2', '📋', 'bg-rose-500/10 border-rose-500/50 text-rose-700 dark:text-rose-400', 1000, 'database', false),

-- Flexible types
('AGENT', 'Agent', 'AI Agent component', 'Bot', '🤖', 'bg-cyan-600/10 border-cyan-600/50 text-cyan-800 dark:text-cyan-300', 500, 'agent', false),
('OTHER', 'Other', 'Generic/miscellaneous node', 'MoreHorizontal', '❓', 'bg-slate-500/10 border-slate-500/50 text-slate-700 dark:text-slate-400', 500, 'general', false);

-- Phase 3: Add new enum values to node_type
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'WEB_COMPONENT';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'HOOK_COMPOSABLE';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'API_SERVICE';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'API_ROUTER';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'API_MIDDLEWARE';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'API_CONTROLLER';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'API_UTIL';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'EXTERNAL_SERVICE';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'SCHEMA';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'TABLE';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'AGENT';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'OTHER';

-- RPC function to get node types
CREATE OR REPLACE FUNCTION public.get_canvas_node_types(
  p_include_legacy boolean DEFAULT false
)
RETURNS SETOF canvas_node_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT * FROM public.canvas_node_types
    WHERE is_active = true
      AND (p_include_legacy = true OR is_legacy = false)
    ORDER BY order_score, display_label;
END;
$function$;