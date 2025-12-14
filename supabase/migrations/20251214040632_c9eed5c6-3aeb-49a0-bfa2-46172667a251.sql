-- Enable REPLICA IDENTITY FULL for real-time UPDATE events on agent_file_operations
ALTER TABLE public.agent_file_operations REPLICA IDENTITY FULL;