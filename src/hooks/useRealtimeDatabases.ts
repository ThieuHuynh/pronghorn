import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProjectDatabase = Database["public"]["Tables"]["project_databases"]["Row"];

export const useRealtimeDatabases = (
  projectId: string | undefined,
  shareToken: string | null,
  enabled: boolean = true
) => {
  const [databases, setDatabases] = useState<ProjectDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadDatabases = useCallback(async () => {
    if (!projectId || !enabled) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_databases_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null,
      });

      if (!error) {
        setDatabases((data as ProjectDatabase[]) || []);
      }
    } catch (error) {
      console.error("Error loading databases:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, shareToken, enabled]);

  // Broadcast refresh to other clients
  const broadcastRefresh = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "database_refresh",
        payload: { projectId },
      });
    }
  }, [projectId]);

  useEffect(() => {
    loadDatabases();

    if (!projectId || !enabled) return;

    const channel = supabase
      .channel(`databases-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_databases",
          filter: `project_id=eq.${projectId}`,
        },
        () => loadDatabases()
      )
      .on("broadcast", { event: "database_refresh" }, () => loadDatabases())
      .subscribe((status) => {
        console.log("Databases channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, enabled, shareToken, loadDatabases]);

  return {
    databases,
    isLoading,
    refresh: loadDatabases,
    broadcastRefresh,
  };
};
