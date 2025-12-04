-- Enable REPLICA IDENTITY FULL for complete row data in realtime events
ALTER TABLE public.artifacts REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication for postgres_changes to work
ALTER PUBLICATION supabase_realtime ADD TABLE public.artifacts;