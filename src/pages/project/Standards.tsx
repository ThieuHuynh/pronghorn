import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PrimaryNav } from "@/components/layout/PrimaryNav";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { StandardsTreeSelector } from "@/components/standards/StandardsTreeSelector";
import { TechStackTreeSelector } from "@/components/techstack/TechStackTreeSelector";

interface Standard {
  id: string;
  code: string;
  title: string;
  description?: string;
  parent_id?: string;
  children?: Standard[];
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  standards: Standard[];
}

interface TechStack {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export default function Standards() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("token");
  const [categories, setCategories] = useState<Category[]>([]);
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set());
  const [selectedTechStacks, setSelectedTechStacks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load categories and standards
      const { data: categoriesData } = await supabase
        .from("standard_categories")
        .select("*")
        .order("order_index");

      const { data: standardsData } = await supabase
        .from("standards")
        .select("*")
        .order("order_index");

      // Build hierarchy
      const categoriesWithStandards: Category[] = (categoriesData || []).map((cat) => ({
        ...cat,
        standards: buildStandardsHierarchy(
          (standardsData || []).filter((s) => s.category_id === cat.id)
        ),
      }));

      setCategories(categoriesWithStandards);

      // Load tech stacks
      const { data: techStacksData } = await supabase
        .from("tech_stacks")
        .select("*")
        .order("name");

      setTechStacks(techStacksData || []);

      // Load selected standards and tech stacks for this project
      const { data: projectStandards } = await supabase.rpc("get_project_standards_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null
      });

      const { data: projectTechStacks } = await supabase.rpc("get_project_tech_stacks_with_token", {
        p_project_id: projectId,
        p_token: shareToken || null
      });

      setSelectedStandards(new Set(projectStandards?.map((ps) => ps.standard_id) || []));
      // Map project tech stack IDs to the parent tech stack IDs for the tree selector
      setSelectedTechStacks(new Set(projectTechStacks?.map((pts) => pts.tech_stack_id) || []));
    } catch (error: any) {
      toast.error("Failed to load standards: " + error.message);
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get existing project standards and tech stacks to delete
      const { data: existingStandards } = await supabase.rpc("get_project_standards_with_token", {
        p_project_id: projectId!,
        p_token: shareToken || null
      });

      const { data: existingTechStacks } = await supabase.rpc("get_project_tech_stacks_with_token", {
        p_project_id: projectId!,
        p_token: shareToken || null
      });

      // Delete all existing project standards
      if (existingStandards && existingStandards.length > 0) {
        for (const existing of existingStandards) {
          await supabase.rpc("delete_project_standard_with_token", {
            p_id: existing.id,
            p_token: shareToken || null
          });
        }
      }

      // Insert new selections for standards
      if (selectedStandards.size > 0) {
        for (const standardId of Array.from(selectedStandards)) {
          await supabase.rpc("insert_project_standard_with_token", {
            p_project_id: projectId!,
            p_token: shareToken || null,
            p_standard_id: standardId
          });
        }
      }

      // Delete all existing project tech stacks
      if (existingTechStacks && existingTechStacks.length > 0) {
        for (const existing of existingTechStacks) {
          await supabase.rpc("delete_project_tech_stack_with_token", {
            p_id: existing.id,
            p_token: shareToken || null
          });
        }
      }

      // Insert new selections for tech stacks (parent tech stack IDs only)
      if (selectedTechStacks.size > 0) {
        // Convert selected item IDs back to parent tech stack IDs
        const parentTechStackIds = new Set<string>();
        techStacks.forEach(stack => {
          // If any item from this tech stack is selected, include the tech stack
          if (selectedTechStacks.has(stack.id)) {
            parentTechStackIds.add(stack.id);
          }
        });

        for (const techStackId of Array.from(parentTechStackIds)) {
          await supabase.rpc("insert_project_tech_stack_with_token", {
            p_project_id: projectId!,
            p_token: shareToken || null,
            p_tech_stack_id: techStackId
          });
        }
      }

      toast.success("Project standards saved successfully");
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PrimaryNav />
        <div className="flex relative">
          <ProjectSidebar projectId={projectId!} />
          <div className="flex-1 w-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PrimaryNav />
      <div className="flex relative">
        <ProjectSidebar projectId={projectId!} />
        <main className="flex-1 w-full overflow-auto">
          <div className="container px-6 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold mb-2">Project Standards</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Select applicable standards and tech stacks for this project
            </p>

            <div className="space-y-6">
              {/* Tech Stacks Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Tech Stacks</CardTitle>
                  <CardDescription>Select applicable technology stack items</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <TechStackTreeSelector
                      techStacks={techStacks.map(ts => ({ ...ts, items: [] }))}
                      selectedItems={selectedTechStacks}
                      onSelectionChange={setSelectedTechStacks}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Standards Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Standards</CardTitle>
                  <CardDescription>
                    Select standards hierarchically - parent selections include all children
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <StandardsTreeSelector
                      categories={categories}
                      selectedStandards={selectedStandards}
                      onSelectionChange={setSelectedStandards}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => { setSelectedStandards(new Set()); setSelectedTechStacks(new Set()); }}>
                  Reset
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
