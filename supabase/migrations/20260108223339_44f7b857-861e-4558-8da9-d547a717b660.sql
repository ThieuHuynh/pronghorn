-- Drop the older version without p_close_session that returns artifacts
DROP FUNCTION IF EXISTS public.merge_collaboration_to_artifact_with_token(uuid, uuid);