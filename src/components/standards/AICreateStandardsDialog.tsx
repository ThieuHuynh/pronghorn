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
import { Sparkles, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdmin } from "@/contexts/AdminContext";

interface AICreateStandardsDialogProps {
  categories: any[];
  onSuccess: () => void;
}

export function AICreateStandardsDialog({ categories, onSuccess }: AICreateStandardsDialogProps) {
  const { isAdmin, requestAdminAccess } = useAdmin();
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!isAdmin) {
      const granted = await requestAdminAccess();
      if (!granted) {
        toast.error("Admin access required to create standards");
        return;
      }
    }

    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    if (!prompt.trim() && files.length === 0) {
      toast.error("Please provide a prompt or upload at least one document");
      return;
    }

    setIsGenerating(true);
    try {
      // Process files if any
      let parsedContent = "";
      
      if (files.length > 0) {
        toast.info("Parsing documents...");
        
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);

          // Upload file to temporary storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("requirement-sources")
            .upload(`temp/${Date.now()}-${file.name}`, file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("requirement-sources")
            .getPublicUrl(uploadData.path);

          parsedContent += `\n\nFile: ${file.name}\n`;
          
          // For text files, read directly
          if (file.type.includes("text") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
            const text = await file.text();
            parsedContent += text;
          } else {
            parsedContent += `[Binary file uploaded: ${urlData.publicUrl}]`;
          }
        }
      }

      // Combine prompt and parsed content
      const combinedInput = `${prompt}\n\n${parsedContent}`.trim();

      // Call AI edge function to generate standards
      const { data, error } = await supabase.functions.invoke("ai-create-standards", {
        body: {
          input: combinedInput,
          categoryId: selectedCategory
        }
      });

      if (error) throw error;

      toast.success(`Created ${data.createdCount} standards successfully!`);
      setOpen(false);
      setPrompt("");
      setFiles([]);
      setSelectedCategory("");
      onSuccess();
    } catch (error) {
      console.error("Error generating standards:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate standards");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Create
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Create Standards</DialogTitle>
          <DialogDescription>
            Upload documents or provide a prompt to automatically generate comprehensive hierarchical standards
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Target Category *</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt (Optional)</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the standards you want to create... (e.g., 'Create comprehensive security standards for web applications including authentication, authorization, data protection, and secure coding practices')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Upload Documents (Optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                id="file-upload"
                type="file"
                multiple
                accept=".txt,.md,.pdf,.doc,.docx,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Word, Excel, Text, Markdown
                </p>
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({files.length})</Label>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Standards
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
