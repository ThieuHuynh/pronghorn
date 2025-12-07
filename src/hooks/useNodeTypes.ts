import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CanvasNodeType {
  id: string;
  system_name: string;
  display_label: string;
  description: string | null;
  icon: string;
  emoji: string | null;
  color_class: string;
  order_score: number;
  category: string;
  is_legacy: boolean;
  is_active: boolean;
}

export function useNodeTypes(includeLegacy = false) {
  return useQuery({
    queryKey: ['canvas-node-types', includeLegacy],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_canvas_node_types', {
        p_include_legacy: includeLegacy
      });
      if (error) throw error;
      return data as CanvasNodeType[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}

// Helper to get order score for a node type
export function getOrderScore(nodeTypes: CanvasNodeType[], typeName: string): number {
  const nodeType = nodeTypes.find(nt => nt.system_name === typeName);
  return nodeType?.order_score ?? 500;
}

// Helper to get color class for a node type
export function getColorClass(nodeTypes: CanvasNodeType[], typeName: string): string {
  const nodeType = nodeTypes.find(nt => nt.system_name === typeName);
  return nodeType?.color_class ?? 'bg-gray-500/10 border-gray-500/50 text-gray-700 dark:text-gray-400';
}

// Helper to group node types by category
export function groupByCategory(nodeTypes: CanvasNodeType[]): Record<string, CanvasNodeType[]> {
  return nodeTypes.reduce((acc, nt) => {
    const category = nt.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(nt);
    return acc;
  }, {} as Record<string, CanvasNodeType[]>);
}
