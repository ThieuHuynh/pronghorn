-- Add new node types for canvas annotations
ALTER TYPE public.node_type ADD VALUE IF NOT EXISTS 'NOTES';
ALTER TYPE public.node_type ADD VALUE IF NOT EXISTS 'ZONE';
ALTER TYPE public.node_type ADD VALUE IF NOT EXISTS 'LABEL';