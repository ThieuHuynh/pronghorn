import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HtmlPreviewProps {
  content: string;
  className?: string;
}

export function HtmlPreview({ content, className }: HtmlPreviewProps) {
  const [key, setKey] = useState(0);

  // Force iframe refresh when content changes significantly
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [content]);

  // Wrap content in full HTML structure if needed
  const wrappedContent = useMemo(() => {
    const trimmed = content.trim().toLowerCase();
    
    // If content already has full HTML structure, use as-is
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      return content;
    }
    
    // Otherwise, wrap in basic HTML structure
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
  }, [content]);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          className="h-7 bg-background/80 backdrop-blur"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
      <iframe
        key={key}
        srcDoc={wrappedContent}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
        className="w-full flex-1 border-0 bg-white rounded"
        title="HTML Preview"
      />
    </div>
  );
}
