import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectStandard {
  id: string;
  project_id: string;
  standard_id: string;
  created_at: string;
}

export interface ProjectTechStack {
  id: string;
  project_id: string;
  tech_stack_id: string;
  created_at: string;
}

export const useRealtimeProjectStandards = (
  projectId: string | undefined,
  shareToken: string | null,
  enabled: boolean = true
) => {
  const [projectStandards, setProjectStandards] = useState<ProjectStandard[]>([]);
  const [projectTechStacks, setProjectTechStacks] = useState<ProjectTechStack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId || !enabled) return;

    setIsLoading(true);
    try {
      const [standardsResult, techStacksResult] = await Promise.all([
        supabase.rpc("get_project_standards_with_token", {
          p_project_id: projectId,
          p_token: shareToken || null,
        }),
        supabase.rpc("get_project_tech_stacks_with_token", {
          p_project_id: projectId,
          p_token: shareToken || null,
        }),
      ]);

      if (!standardsResult.error && standardsResult.data) {
        setProjectStandards(standardsResult.data as ProjectStandard[]);
      }
      if (!techStacksResult.error && techStacksResult.data) {
        setProjectTechStacks(techStacksResult.data as ProjectTechStack[]);
      }
    } catch (error) {
      console.error("Error loading project standards:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, shareToken, enabled]);

  const broadcastRefresh = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "project_standards_refresh",
        payload: { projectId },
      });
    }
  }, [projectId]);

  useEffect(() => {
    loadData();

    if (!projectId || !enabled) return;

    const channel = supabase
      .channel(`project-standards-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_standards",
          filter: `project_id=eq.${projectId}`,
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_tech_stacks",
          filter: `project_id=eq.${projectId}`,
        },
        () => loadData()
      )
      .on("broadcast", { event: "project_standards_refresh" }, () => loadData())
      .subscribe((status) => {
        console.log("Project standards channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, enabled, shareToken, loadData]);

  return {
    projectStandards,
    projectTechStacks,
    isLoading,
    refresh: loadData,
    broadcastRefresh,
  };
};
