import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Standard {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  parent_id?: string | null;
  children?: Standard[];
}

interface StandardCategory {
  id: string;
  name: string;
  description: string | null;
  standards: Standard[];
}

interface StandardsCategoryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StandardsCategoryPicker({ selectedIds, onChange }: StandardsCategoryPickerProps) {
  const [categories, setCategories] = useState<StandardCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategoriesWithStandards();
  }, []);

  const loadCategoriesWithStandards = async () => {
    try {
      // Load categories
      const { data: categoriesData, error: catError } = await supabase
        .from("standard_categories")
        .select("id, name, description")
        .order("order_index");

      if (catError) throw catError;

      // Load all standards
      const { data: standardsData, error: stdError } = await supabase
        .from("standards")
        .select("*")
        .order("order_index");

      if (stdError) throw stdError;

      // Build hierarchy for each category
      const categoriesWithStandards: StandardCategory[] = (categoriesData || []).map((cat) => ({
        ...cat,
        standards: buildStandardsHierarchy(
          (standardsData || []).filter((s) => s.category_id === cat.id)
        ),
      }));

      setCategories(categoriesWithStandards);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildStandardsHierarchy = (flatStandards: any[]): Standard[] => {
    const map = new Map<string, Standard>();
    const roots: Standard[] = [];

    flatStandards.forEach((std) => {
      map.set(std.id, { ...std, children: [] });
    });

    flatStandards.forEach((std) => {
      const node = map.get(std.id)!;
      if (std.parent_id && map.has(std.parent_id)) {
        map.get(std.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const selectedSet = new Set(selectedIds);

  // Toggle category selection - this selects the category ID itself (for build_book_standards)
  const toggleCategory = (categoryId: string) => {
    onChange(
      selectedIds.includes(categoryId)
        ? selectedIds.filter((id) => id !== categoryId)
        : [...selectedIds, categoryId]
    );
  };

  const toggleExpandCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleExpandStandard = (standardId: string) => {
    const newExpanded = new Set(expandedStandards);
    if (newExpanded.has(standardId)) {
      newExpanded.delete(standardId);
    } else {
      newExpanded.add(standardId);
    }
    setExpandedStandards(newExpanded);
  };

  const renderStandard = (standard: Standard, level: number = 0) => {
    const isExpanded = expandedStandards.has(standard.id);
    const hasChildren = standard.children && standard.children.length > 0;

    return (
      <div key={standard.id} className="space-y-1">
        <div
          className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2 text-muted-foreground"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpandStandard(standard.id)}
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
          <span className="text-xs">
            <span className="font-medium">{standard.code}</span> - {standard.title}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {standard.children!.map((child) => renderStandard(child, level + 1))}
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

  if (categories.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No standard categories available
      </div>
    );
  }

  return (
    <div className="border rounded-md max-h-[400px] overflow-y-auto p-2 space-y-2">
      {categories.map((category) => {
        const isSelected = selectedSet.has(category.id);
        const isExpanded = expandedCategories.has(category.id);
        const hasStandards = category.standards.length > 0;

        return (
          <div key={category.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              {hasStandards && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpandCategory(category.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!hasStandards && <div className="w-6" />}
              <Checkbox
                id={`category-${category.id}`}
                checked={isSelected}
                onCheckedChange={() => toggleCategory(category.id)}
              />
              <Label
                htmlFor={`category-${category.id}`}
                className="font-semibold cursor-pointer flex-1"
              >
                {category.name}
              </Label>
            </div>
            {category.description && (
              <p className="text-xs text-muted-foreground pl-14">{category.description}</p>
            )}
            {isExpanded && hasStandards && (
              <div className="space-y-1 pt-2 border-l-2 border-border ml-3 pl-2">
                {category.standards.map((standard) => renderStandard(standard, 0))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
