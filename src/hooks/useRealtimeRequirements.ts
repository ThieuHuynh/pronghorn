import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Requirement } from "@/components/requirements/RequirementsTree";
import { useSearchParams } from "react-router-dom";

export function useRealtimeRequirements(projectId: string) {
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("token");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load
    loadRequirements();

    // Set up real-time subscription
    const channel = supabase
      .channel(`requirements-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requirements",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log("Requirements change detected:", payload);
          loadRequirements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadRequirements = async () => {
    try {
      const { data, error } = await supabase.rpc("get_requirements_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null
      });

      if (error) throw error;

      // Build hierarchical structure
      const hierarchical = buildHierarchy(data || []);
      setRequirements(hierarchical);
    } catch (error) {
      console.error("Error loading requirements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildHierarchy = (flatList: any[]): Requirement[] => {
    const map = new Map<string, Requirement>();
    const roots: Requirement[] = [];

    // Sort by code first
    const sorted = [...flatList].sort((a, b) => {
      const codeA = a.code || "";
      const codeB = b.code || "";
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    // First pass: create all nodes
    sorted.forEach((item) => {
      map.set(item.id, {
        id: item.id,
        code: item.code,
        type: item.type,
        title: item.title,
        content: item.content,
        parentId: item.parent_id,
        children: [],
      });
    });

    // Second pass: build tree
    sorted.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id) {
        const parent = map.get(item.parent_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const addRequirement = async (
    parentId: string | null,
    type: Requirement["type"],
    title: string
  ) => {
    try {
      const { error } = await supabase.rpc("insert_requirement_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null,
        p_parent_id: parentId,
        p_type: type,
        p_title: title
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error adding requirement:", error);
      throw error;
    }
  };

  const updateRequirement = async (id: string, updates: Partial<Requirement>) => {
    try {
      const { error } = await supabase.rpc("update_requirement_with_token", {
        p_id: id,
        p_token: shareToken || null,
        p_title: updates.title || "",
        p_content: updates.content || ""
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error updating requirement:", error);
      throw error;
    }
  };

  const deleteRequirement = async (id: string) => {
    try {
      await supabase.rpc("delete_requirement_with_token", {
        p_id: id,
        p_token: shareToken || null
      });
    } catch (error) {
      console.error("Error deleting requirement:", error);
      throw error;
    }
  };

  return {
    requirements,
    isLoading,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    refresh: loadRequirements,
  };
}
