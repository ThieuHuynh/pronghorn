import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface TechStackItem {
  id: string;
  type: string | null;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  children?: TechStackItem[];
}

interface TechStack {
  id: string;
  name: string;
  description: string | null;
  items: TechStackItem[];
}

interface TechStackPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TechStackPicker({ selectedIds, onChange }: TechStackPickerProps) {
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTechStacksWithItems();
  }, []);

  const loadTechStacksWithItems = async () => {
    try {
      // Load top-level tech stacks (parent_id IS NULL and type IS NULL)
      const { data: stacksData, error: stackError } = await supabase
        .from("tech_stacks")
        .select("id, name, description")
        .is("parent_id", null)
        .is("type", null)
        .order("name");

      if (stackError) throw stackError;

      // For each stack, load its child items
      const stacksWithItems: TechStack[] = [];
      
      for (const stack of stacksData || []) {
        const { data: itemsData } = await supabase
          .from("tech_stacks")
          .select("*")
          .eq("parent_id", stack.id)
          .order("order_index");

        stacksWithItems.push({
          ...stack,
          items: buildItemsHierarchy(itemsData || [], stack.id),
        });
      }

      setTechStacks(stacksWithItems);
    } catch (error) {
      console.error("Error loading tech stacks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildItemsHierarchy = (flatItems: any[], parentStackId: string): TechStackItem[] => {
    const map = new Map<string, TechStackItem>();
    const roots: TechStackItem[] = [];

    flatItems.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    flatItems.forEach((item) => {
      const node = map.get(item.id)!;
      // If parent_id matches another item in this set, it's a nested child
      // Otherwise it's a direct child of the tech stack
      if (item.parent_id && item.parent_id !== parentStackId && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const selectedSet = new Set(selectedIds);

  // Toggle stack selection - this selects the stack ID itself (for build_book_tech_stacks)
  const toggleStack = (stackId: string) => {
    onChange(
      selectedIds.includes(stackId)
        ? selectedIds.filter((id) => id !== stackId)
        : [...selectedIds, stackId]
    );
  };

  const toggleExpandStack = (stackId: string) => {
    const newExpanded = new Set(expandedStacks);
    if (newExpanded.has(stackId)) {
      newExpanded.delete(stackId);
    } else {
      newExpanded.add(stackId);
    }
    setExpandedStacks(newExpanded);
  };

  const toggleExpandItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const renderItem = (item: TechStackItem, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id} className="space-y-1">
        <div
          className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2 text-muted-foreground"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpandItem(item.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          <div className="flex items-center gap-2 text-xs">
            {item.type && (
              <Badge variant="outline" className="text-[10px]">
                {item.type}
              </Badge>
            )}
            <span>{item.name}</span>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {item.children!.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (techStacks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No tech stacks available
      </div>
    );
  }

  return (
    <div className="border rounded-md max-h-[400px] overflow-y-auto p-2 space-y-2">
      {techStacks.map((stack) => {
        const isSelected = selectedSet.has(stack.id);
        const isExpanded = expandedStacks.has(stack.id);
        const hasItems = stack.items.length > 0;

        return (
          <div key={stack.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              {hasItems && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpandStack(stack.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!hasItems && <div className="w-6" />}
              <Checkbox
                id={`stack-${stack.id}`}
                checked={isSelected}
                onCheckedChange={() => toggleStack(stack.id)}
              />
              <Label
                htmlFor={`stack-${stack.id}`}
                className="font-semibold cursor-pointer flex-1"
              >
                {stack.name}
              </Label>
            </div>
            {stack.description && (
              <p className="text-xs text-muted-foreground pl-14">{stack.description}</p>
            )}
            {isExpanded && hasItems && (
              <div className="space-y-1 pt-2 border-l-2 border-border ml-3 pl-2">
                {stack.items.map((item) => renderItem(item, 0))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
