import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Deployment = Database["public"]["Tables"]["project_deployments"]["Row"];

export const useRealtimeDeployments = (
  projectId: string | undefined,
  shareToken: string | null,
  enabled: boolean = true
) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadDeployments = useCallback(async () => {
    if (!projectId || !enabled) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_deployments_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null,
      });

      if (!error) {
        setDeployments((data as Deployment[]) || []);
      }
    } catch (error) {
      console.error("Error loading deployments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, shareToken, enabled]);

  // Broadcast refresh to other clients
  const broadcastRefresh = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "deployment_refresh",
        payload: { projectId },
      });
    }
  }, [projectId]);

  useEffect(() => {
    loadDeployments();

    if (!projectId || !enabled) return;

    const channel = supabase
      .channel(`deployments-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_deployments",
          filter: `project_id=eq.${projectId}`,
        },
        () => loadDeployments()
      )
      .on("broadcast", { event: "deployment_refresh" }, () => loadDeployments())
      .subscribe((status) => {
        console.log("Deployments channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, enabled, shareToken, loadDeployments]);

  return {
    deployments,
    isLoading,
    refresh: loadDeployments,
    broadcastRefresh,
  };
};
