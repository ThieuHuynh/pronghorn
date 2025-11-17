import { PrimaryNav } from "@/components/layout/PrimaryNav";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { RequirementsTree, RequirementType } from "@/components/requirements/RequirementsTree";
import { AIDecomposeDialog } from "@/components/requirements/AIDecomposeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Upload } from "lucide-react";
import { useParams } from "react-router-dom";
import { useRealtimeRequirements } from "@/hooks/useRealtimeRequirements";
import { toast } from "sonner";

export default function Requirements() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    requirements,
    isLoading,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    refresh,
  } = useRealtimeRequirements(projectId!);

  const handleNodeUpdate = async (id: string, updates: { title?: string; content?: string }) => {
    try {
      await updateRequirement(id, updates);
      toast.success("Requirement updated");
    } catch (error) {
      toast.error("Failed to update requirement");
    }
  };

  const handleNodeDelete = async (id: string) => {
    try {
      await deleteRequirement(id);
      toast.success("Requirement deleted");
    } catch (error) {
      toast.error("Failed to delete requirement");
    }
  };

  const handleNodeAdd = async (parentId: string | null, type: RequirementType) => {
    try {
      await addRequirement(parentId, type, `New ${type}`);
      toast.success("Requirement added");
    } catch (error) {
      toast.error("Failed to add requirement");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PrimaryNav />
      
      <div className="flex">
        <ProjectSidebar projectId={projectId!} />
        
        <main className="flex-1 overflow-auto">
          <div className="container px-6 py-8 max-w-6xl">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Requirements</h1>
              <p className="text-muted-foreground">
                Manage your project requirements hierarchy
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requirements..."
                  className="pl-9"
                />
              </div>
              
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>
              
              <AIDecomposeDialog projectId={projectId!} onComplete={refresh} />
              
              <Button className="gap-2" onClick={() => handleNodeAdd(null, "EPIC")}>
                <Plus className="h-4 w-4" />
                Add Epic
              </Button>
            </div>

            {/* Requirements Tree */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading requirements...</p>
              </div>
            ) : requirements.length > 0 ? (
              <div className="bg-card border border-border rounded-lg p-4">
                <RequirementsTree
                  requirements={requirements}
                  onNodeUpdate={handleNodeUpdate}
                  onNodeDelete={handleNodeDelete}
                  onNodeAdd={handleNodeAdd}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No requirements yet. Start by adding an Epic or use AI to decompose a document.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button className="gap-2" onClick={() => handleNodeAdd(null, "EPIC")}>
                    <Plus className="h-4 w-4" />
                    Add Your First Epic
                  </Button>
                  <AIDecomposeDialog projectId={projectId!} onComplete={refresh} />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
