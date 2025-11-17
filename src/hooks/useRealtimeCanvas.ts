import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Node, Edge, useNodesState, useEdgesState } from "reactflow";

export function useRealtimeCanvas(projectId: string, initialNodes: Node[], initialEdges: Edge[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    // Load canvas data
    loadCanvasData();

    // Set up real-time subscriptions
    const nodesChannel = supabase
      .channel(`canvas-nodes-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvas_nodes",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log("Canvas nodes change:", payload);
          loadCanvasData();
        }
      )
      .subscribe();

    const edgesChannel = supabase
      .channel(`canvas-edges-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvas_edges",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log("Canvas edges change:", payload);
          loadCanvasData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(edgesChannel);
    };
  }, [projectId]);

  const loadCanvasData = async () => {
    try {
      const [nodesResult, edgesResult] = await Promise.all([
        supabase
          .from("canvas_nodes")
          .select("*")
          .eq("project_id", projectId),
        supabase
          .from("canvas_edges")
          .select("*")
          .eq("project_id", projectId),
      ]);

      if (nodesResult.error) throw nodesResult.error;
      if (edgesResult.error) throw edgesResult.error;

      const loadedNodes: Node[] = (nodesResult.data || []).map((node) => ({
        id: node.id,
        type: "custom",
        position: node.position as { x: number; y: number },
        data: node.data,
      }));

      const loadedEdges: Edge[] = (edgesResult.data || []).map((edge) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_id,
        label: edge.label,
      }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
    } catch (error) {
      console.error("Error loading canvas data:", error);
    }
  };

  const saveNode = async (node: Node) => {
    try {
      const { data: existing } = await supabase
        .from("canvas_nodes")
        .select("id")
        .eq("id", node.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("canvas_nodes")
          .update({
            type: node.data.type,
            position: node.position as any,
            data: node.data as any,
          })
          .eq("id", node.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("canvas_nodes").insert([{
          project_id: projectId,
          type: node.data.type,
          position: node.position as any,
          data: node.data as any,
        }]);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving node:", error);
    }
  };

  const saveEdge = async (edge: Edge) => {
    try {
      const { data: existing } = await supabase
        .from("canvas_edges")
        .select("id")
        .eq("id", edge.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("canvas_edges")
          .update({
            source_id: edge.source,
            target_id: edge.target,
            label: edge.label as string,
          })
          .eq("id", edge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("canvas_edges").insert([{
          project_id: projectId,
          source_id: edge.source,
          target_id: edge.target,
          label: edge.label as string,
        }]);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving edge:", error);
    }
  };

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    saveNode,
    saveEdge,
  };
}
