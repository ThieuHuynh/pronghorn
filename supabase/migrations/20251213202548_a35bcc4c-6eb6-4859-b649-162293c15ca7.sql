-- Drop the legacy unique index that only allows one spec per project
-- This index was blocking multiple agents and versions from saving
DROP INDEX IF EXISTS idx_project_specifications_project_id;