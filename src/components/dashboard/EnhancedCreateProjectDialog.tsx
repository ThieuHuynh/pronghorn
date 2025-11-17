import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";

export function EnhancedCreateProjectDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [useAI, setUseAI] = useState(false);

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organization, setOrganization] = useState("");
  
  // Metadata fields
  const [budget, setBudget] = useState("");
  const [scope, setScope] = useState("");
  const [timelineStart, setTimelineStart] = useState("");
  const [timelineEnd, setTimelineEnd] = useState("");
  const [priority, setPriority] = useState("medium");
  const [tags, setTags] = useState("");

  // AI fields
  const [aiPrompt, setAiPrompt] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setOrganization("");
    setBudget("");
    setScope("");
    setTimelineStart("");
    setTimelineEnd("");
    setPriority("medium");
    setTags("");
    setAiPrompt("");
    setUseAI(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    setIsCreating(true);

    try {
      // Get or create default organization
      let { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      
      let orgId: string;
      if (!orgs || orgs.length === 0) {
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: 'Default Organization' })
          .select('id')
          .single();
        
        if (orgError) throw orgError;
        orgId = newOrg.id;
      } else {
        orgId = orgs[0].id;
      }

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          organization: organization.trim() || null,
          budget: budget ? parseFloat(budget) : null,
          scope: scope.trim() || null,
          timeline_start: timelineStart || null,
          timeline_end: timelineEnd || null,
          priority: priority,
          tags: tags ? tags.split(',').map(t => t.trim()) : null,
          org_id: orgId,
          status: 'DESIGN'
        })
        .select()
        .single();

      if (error) throw error;

      // If AI is enabled and there's a prompt, decompose requirements
      if (useAI && aiPrompt.trim()) {
        const { error: aiError } = await supabase.functions.invoke("decompose-requirements", {
          body: { 
            text: aiPrompt.trim(), 
            projectId: project.id 
          },
        });

        if (aiError) {
          console.error("AI decomposition error:", aiError);
          toast.warning("Project created but AI decomposition failed. You can try again later.");
        } else {
          toast.success("Project created with AI-generated requirements!");
        }
      } else {
        toast.success("Project created successfully!");
      }

      setOpen(false);
      resetForm();
      
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Navigate to the new project
      navigate(`/project/${project.id}/requirements`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new project with detailed metadata and optional AI-powered requirements generation
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="Enterprise Portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                placeholder="Acme Corp"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="100000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Textarea
                id="scope"
                placeholder="Define the project scope..."
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timelineStart">Start Date</Label>
                <Input
                  id="timelineStart"
                  type="date"
                  value={timelineStart}
                  onChange={(e) => setTimelineStart(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timelineEnd">End Date</Label>
                <Input
                  id="timelineEnd"
                  type="date"
                  value={timelineEnd}
                  onChange={(e) => setTimelineEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="web, api, mobile"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="space-y-2">
              <Label>AI Requirements Generation</Label>
              <p className="text-sm text-muted-foreground">
                Paste your requirements document or project description below. AI will automatically decompose it into a structured hierarchy of Epics, Features, Stories, and Acceptance Criteria.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiPrompt">Requirements Text</Label>
              <Textarea
                id="aiPrompt"
                placeholder="Paste your requirements document, meeting notes, or project brief here..."
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value);
                  setUseAI(e.target.value.trim().length > 0);
                }}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Example: "Build a user authentication system with email/password login, password reset, and OAuth integration..."
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : useAI ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create with AI
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
