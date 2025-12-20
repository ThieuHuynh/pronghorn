import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Eye, Code, Save, Loader2 } from 'lucide-react';
import Editor, { Monaco } from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CollaborationEditorProps {
  content: string;
  isMarkdown: boolean;
  onChange: (content: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  readOnly?: boolean;
  highlightedLines?: { start: number; end: number }[];
}

export function CollaborationEditor({
  content,
  isMarkdown,
  onChange,
  onSave,
  isSaving,
  hasUnsavedChanges,
  readOnly = false,
  highlightedLines = [],
}: CollaborationEditorProps) {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>(isMarkdown ? 'rendered' : 'source');
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save on blur or after idle period
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Apply initial decorations
    if (highlightedLines.length > 0) {
      applyHighlightDecorations(editor, monaco, highlightedLines);
    }
  };
  
  const applyHighlightDecorations = (editor: any, monaco: any, lines: { start: number; end: number }[]) => {
    if (!editor || !monaco) return;
    
    const decorations = lines.map(({ start, end }) => ({
      range: new monaco.Range(start, 1, end, 1),
      options: {
        isWholeLine: true,
        className: 'collaboration-highlighted-line',
        linesDecorationsClassName: 'collaboration-highlighted-gutter',
      },
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  };
  
  // Update decorations when highlightedLines change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      if (highlightedLines.length > 0) {
        applyHighlightDecorations(editorRef.current, monacoRef.current, highlightedLines);
      } else {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
    }
  }, [highlightedLines]);

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
      // Just mark as changed, no auto-save (user should manually save)
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (hasUnsavedChanges) {
        onSave();
      }
    }
  }, [onSave, hasUnsavedChanges]);

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Always show toggle for switching between rendered and source view */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'rendered' | 'source')}>
            <TabsList className="h-8">
              <TabsTrigger value="rendered" className="text-xs h-6 px-2">
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="source" className="text-xs h-6 px-2">
                <Code className="h-3 w-3 mr-1" />
                Source
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="h-7"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 min-h-0">
        {viewMode === 'rendered' ? (
          <ScrollArea className="h-full">
            <div 
              className="p-4 prose prose-sm dark:prose-invert max-w-none cursor-pointer"
              onClick={() => !readOnly && setViewMode('source')}
            >
              {content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">
                  {readOnly ? 'No content' : 'Click to edit...'}
                </p>
              )}
            </div>
          </ScrollArea>
        ) : (
          <Editor
            height="100%"
            defaultLanguage={isMarkdown ? 'markdown' : 'plaintext'}
            value={content}
            onChange={handleContentChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'on',
              fontSize: 13,
              scrollBeyondLastLine: false,
              readOnly,
              padding: { top: 12 },
              automaticLayout: true,
            }}
            theme="vs-dark"
          />
        )}
      </div>
      
      {/* CSS for highlighted lines */}
      <style>{`
        .collaboration-highlighted-line {
          background-color: rgba(34, 197, 94, 0.15) !important;
        }
        .collaboration-highlighted-gutter {
          background-color: rgb(34, 197, 94);
          width: 3px !important;
          margin-left: 3px;
        }
      `}</style>
    </div>
  );
}
