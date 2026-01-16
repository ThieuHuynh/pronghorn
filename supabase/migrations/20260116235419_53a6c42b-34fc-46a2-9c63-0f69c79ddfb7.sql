-- Add BLOCK_FUNCTION to the node_type enum
ALTER TYPE public.node_type ADD VALUE IF NOT EXISTS 'BLOCK_FUNCTION';

-- Insert the new node type into canvas_node_types
INSERT INTO public.canvas_node_types (
  system_name, 
  display_label, 
  description, 
  icon, 
  emoji, 
  color_class, 
  order_score, 
  category, 
  is_legacy,
  is_active
) VALUES (
  'BLOCK_FUNCTION', 
  'Block / Function', 
  'Reusable code block or utility function',
  'Blocks',
  '🧱',
  'bg-indigo-400/10 border-indigo-400/50 text-indigo-600 dark:text-indigo-400',
  350,
  'frontend',
  false,
  true
);