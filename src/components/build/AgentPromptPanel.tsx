import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AttachedFile {
  id: string;
  path: string;
}

interface AgentPromptPanelProps {
  attachedFiles: AttachedFile[];
  onRemoveFile: (fileId: string) => void;
  onSubmitTask: (sessionId: string) => void;
  projectId: string;
  shareToken: string | null;
}

export function AgentPromptPanel({
  attachedFiles,
  onRemoveFile,
  onSubmitTask,
  projectId,
  shareToken,
}: AgentPromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("coding-agent-orchestrator", {
        body: {
          projectId,
          taskDescription: prompt,
          attachedFileIds: attachedFiles.map(f => f.id),
          projectContext: {}, // TODO: Add ProjectSelector context
          shareToken,
          mode: "edit", // Default mode, could be made selectable
        },
      });

      if (error) throw error;

      toast({
        title: "Task Submitted",
        description: "CodingAgent is processing your request",
      });

      onSubmitTask(data.sessionId);
      setPrompt("");
    } catch (error) {
      console.error("Error submitting task:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm">Agent Task</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Attached Files ({attachedFiles.length})
          </label>
          <ScrollArea className="h-20 border rounded-md p-2">
            <div className="flex flex-wrap gap-1">
              {attachedFiles.map((file) => (
                <Badge
                  key={file.id}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="text-xs truncate max-w-[150px]">
                    {file.path}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => onRemoveFile(file.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">
            Task Description
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the task for the CodingAgent..."
            className="flex-1 resize-none"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isSubmitting}
          className="w-full gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Task
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
