import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Save, X, FileText } from "lucide-react";

interface CodeEditorProps {
  fileId: string | null;
  filePath: string | null;
  repoId: string;
  onClose: () => void;
  onSave: () => void;
}

export function CodeEditor({ fileId, filePath, repoId, onClose, onSave }: CodeEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("token");

  useEffect(() => {
    if (fileId) {
      loadFileContent();
    } else {
      setContent("");
    }
  }, [fileId]);

  const loadFileContent = async () => {
    if (!fileId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_file_content_with_token", {
        p_file_id: fileId,
        p_token: shareToken || null,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setContent(data[0].content);
      }
    } catch (error) {
      console.error("Error loading file:", error);
      toast({
        title: "Error",
        description: "Failed to load file content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!filePath) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_file_with_token", {
        p_repo_id: repoId,
        p_path: filePath,
        p_content: content,
        p_token: shareToken || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "File saved successfully",
      });
      onSave();
    } catch (error) {
      console.error("Error saving file:", error);
      toast({
        title: "Error",
        description: "Failed to save file",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getLanguage = (path: string | null) => {
    if (!path) return "plaintext";
    const ext = path.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      html: "html",
      css: "css",
      scss: "scss",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sql: "sql",
      sh: "shell",
      bash: "shell",
    };
    return langMap[ext || ""] || "plaintext";
  };

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-[#252526]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-normal truncate text-foreground">{filePath}</h3>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            variant="ghost"
            className="h-8 gap-2 text-foreground hover:bg-accent/50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 hover:bg-accent/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            onChange={(value) => setContent(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
              fontLigatures: true,
              cursorBlinking: "smooth",
              smoothScrolling: true,
              renderLineHighlight: "all",
              bracketPairColorization: { enabled: true },
            }}
          />
        )}
      </div>
    </div>
  );
}
