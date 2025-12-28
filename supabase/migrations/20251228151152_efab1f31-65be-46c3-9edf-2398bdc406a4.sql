-- Change audit_graph_nodes.id from uuid to text to support human-readable local IDs
-- First, drop the primary key constraint
ALTER TABLE public.audit_graph_nodes DROP CONSTRAINT IF EXISTS audit_graph_nodes_pkey;

-- Change the column type from uuid to text
ALTER TABLE public.audit_graph_nodes ALTER COLUMN id TYPE text USING id::text;

-- Change the default to generate text UUIDs for backward compatibility
ALTER TABLE public.audit_graph_nodes ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Re-add the primary key constraint
ALTER TABLE public.audit_graph_nodes ADD PRIMARY KEY (id);

-- Also update audit_graph_edges source_node_id and target_node_id to text if they reference nodes
-- These are already text type based on the schema, so no changes needed there