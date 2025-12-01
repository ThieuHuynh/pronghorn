import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AttachedFile {
  id: string;
  path: string;
}

interface AgentPromptPanelProps {
  attachedFiles: AttachedFile[];
  onRemoveFile: (fileId: string) => void;
  onSubmitTask: (prompt: string, fileIds: string[]) => void;
}

export function AgentPromptPanel({
  attachedFiles,
  onRemoveFile,
  onSubmitTask,
}: AgentPromptPanelProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmitTask(prompt, attachedFiles.map(f => f.id));
    setPrompt("");
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
          disabled={!prompt.trim()}
          className="w-full gap-2"
        >
          <Send className="h-4 w-4" />
          Submit Task
        </Button>
      </CardContent>
    </Card>
  );
}
