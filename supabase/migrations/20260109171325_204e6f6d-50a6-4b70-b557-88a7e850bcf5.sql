-- Fix delete_project_with_token: Remove non-existent requirement_files, add missing project_testing_logs

CREATE OR REPLACE FUNCTION public.delete_project_with_token(p_project_id uuid, p_token uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate access - require owner role for deletion
  PERFORM public.require_role(p_project_id, p_token, 'owner');

  -- Delete in order of dependencies (children first, then parents)
  
  -- 1. Delete artifact collaboration related tables
  DELETE FROM public.artifact_collaboration_blackboard WHERE collaboration_id IN (SELECT id FROM public.artifact_collaborations WHERE project_id = p_project_id);
  DELETE FROM public.artifact_collaboration_history WHERE collaboration_id IN (SELECT id FROM public.artifact_collaborations WHERE project_id = p_project_id);
  DELETE FROM public.artifact_collaboration_messages WHERE collaboration_id IN (SELECT id FROM public.artifact_collaborations WHERE project_id = p_project_id);
  DELETE FROM public.artifact_collaborations WHERE project_id = p_project_id;
  
  -- 2. Delete artifacts
  DELETE FROM public.artifacts WHERE project_id = p_project_id;
  
  -- 3. Delete agent-related tables
  DELETE FROM public.agent_blackboard WHERE session_id IN (SELECT id FROM public.agent_sessions WHERE project_id = p_project_id);
  DELETE FROM public.agent_file_operations WHERE session_id IN (SELECT id FROM public.agent_sessions WHERE project_id = p_project_id);
  DELETE FROM public.agent_llm_logs WHERE project_id = p_project_id;
  DELETE FROM public.agent_messages WHERE session_id IN (SELECT id FROM public.agent_sessions WHERE project_id = p_project_id);
  DELETE FROM public.agent_session_context WHERE session_id IN (SELECT id FROM public.agent_sessions WHERE project_id = p_project_id);
  DELETE FROM public.agent_sessions WHERE project_id = p_project_id;
  DELETE FROM public.project_agents WHERE project_id = p_project_id;
  
  -- 4. Delete canvas-related tables
  DELETE FROM public.canvas_edges WHERE project_id = p_project_id;
  DELETE FROM public.canvas_layers WHERE project_id = p_project_id;
  DELETE FROM public.canvas_nodes WHERE project_id = p_project_id;
  
  -- 5. Delete chat-related tables
  DELETE FROM public.chat_messages WHERE project_id = p_project_id;
  DELETE FROM public.chat_sessions WHERE project_id = p_project_id;
  
  -- 6. Delete deployment-related tables (including project_testing_logs)
  DELETE FROM public.project_testing_logs WHERE project_id = p_project_id;
  DELETE FROM public.deployment_issues WHERE deployment_id IN (SELECT id FROM public.project_deployments WHERE project_id = p_project_id);
  DELETE FROM public.deployment_logs WHERE deployment_id IN (SELECT id FROM public.project_deployments WHERE project_id = p_project_id);
  DELETE FROM public.project_deployments WHERE project_id = p_project_id;
  
  -- 7. Delete database-related tables
  DELETE FROM public.project_database_sql WHERE project_id = p_project_id;
  DELETE FROM public.project_migrations WHERE project_id = p_project_id;
  DELETE FROM public.project_database_connections WHERE project_id = p_project_id;
  DELETE FROM public.project_databases WHERE project_id = p_project_id;
  
  -- 8. Delete repository-related tables
  DELETE FROM public.repo_staging WHERE repo_id IN (SELECT id FROM public.project_repos WHERE project_id = p_project_id);
  DELETE FROM public.repo_files WHERE repo_id IN (SELECT id FROM public.project_repos WHERE project_id = p_project_id);
  DELETE FROM public.repo_commits WHERE repo_id IN (SELECT id FROM public.project_repos WHERE project_id = p_project_id);
  DELETE FROM public.project_repos WHERE project_id = p_project_id;
  
  -- 9. Delete audit-related tables
  DELETE FROM public.audit_activity_stream WHERE session_id IN (SELECT id FROM public.audit_sessions WHERE project_id = p_project_id);
  DELETE FROM public.audit_blackboard WHERE session_id IN (SELECT id FROM public.audit_sessions WHERE project_id = p_project_id);
  DELETE FROM public.audit_graph_edges WHERE session_id IN (SELECT id FROM public.audit_sessions WHERE project_id = p_project_id);
  DELETE FROM public.audit_graph_nodes WHERE session_id IN (SELECT id FROM public.audit_sessions WHERE project_id = p_project_id);
  DELETE FROM public.audit_tesseract_cells WHERE session_id IN (SELECT id FROM public.audit_sessions WHERE project_id = p_project_id);
  DELETE FROM public.audit_sessions WHERE project_id = p_project_id;
  
  -- 10. Delete requirements-related tables (requirement_files removed - does not exist)
  DELETE FROM public.requirement_standards WHERE requirement_id IN (SELECT id FROM public.requirements WHERE project_id = p_project_id);
  DELETE FROM public.requirements WHERE project_id = p_project_id;
  
  -- 11. Delete specifications
  DELETE FROM public.project_specifications WHERE project_id = p_project_id;
  
  -- 12. Delete presentations
  DELETE FROM public.project_presentations WHERE project_id = p_project_id;
  
  -- 13. Delete project standards
  DELETE FROM public.project_standards WHERE project_id = p_project_id;
  
  -- 14. Delete project tech stacks
  DELETE FROM public.project_tech_stacks WHERE project_id = p_project_id;
  
  -- 15. Delete activity logs
  DELETE FROM public.activity_logs WHERE project_id = p_project_id;
  
  -- 16. Delete build sessions
  DELETE FROM public.build_sessions WHERE project_id = p_project_id;
  
  -- 17. Delete linked projects references
  DELETE FROM public.profile_linked_projects WHERE project_id = p_project_id;
  
  -- 18. Delete project tokens
  DELETE FROM public.project_tokens WHERE project_id = p_project_id;
  
  -- 19. Finally delete the project itself
  DELETE FROM public.projects WHERE id = p_project_id;
END;
$function$;