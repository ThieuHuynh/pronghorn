-- Enable realtime for artifacts table
ALTER TABLE public.artifacts REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'artifacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.artifacts;
  END IF;
END $$;