import React, { useCallback, useState } from 'react';
import { FileSpreadsheet, FileJson, Upload, X, Loader2, ClipboardPaste, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseExcelFile, ExcelData } from '@/utils/parseExcel';
import { parseJsonFile, ParsedJsonData, parseJsonString } from '@/utils/parseJson';
import { toast } from 'sonner';
import { ProjectSelector, ProjectSelectionResult } from '@/components/project/ProjectSelector';

interface FileUploaderProps {
  onFileUploaded: (
    type: 'excel' | 'csv' | 'json',
    data: ExcelData | ParsedJsonData,
    rawData?: any,
    fileName?: string
  ) => void;
  accept?: string;
  maxSizeMB?: number;
  projectId?: string;
  shareToken?: string | null;
}

export default function FileUploader({
  onFileUploaded,
  accept = '.xlsx,.xls,.csv,.json',
  maxSizeMB = 20,
  projectId,
  shareToken
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'project'>('upload');
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      setFileName(null);
      return;
    }

    // Determine file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    setIsLoading(true);
    
    try {
      if (extension === 'json') {
        const text = await file.text();
        const rawData = JSON.parse(text);
        const data = await parseJsonFile(file);
        if (data.tables.length === 0) {
          throw new Error('No valid data found in JSON file');
        }
        const tableName = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        onFileUploaded('json', data, rawData, tableName);
        toast.success(`Loaded ${data.tables.length} table(s) from JSON`);
      } else if (extension === 'xlsx' || extension === 'xls') {
        const data = await parseExcelFile(file);
        if (data.sheets.length === 0) {
          throw new Error('No sheets found in Excel file');
        }
        onFileUploaded('excel', data);
        toast.success(`Loaded ${data.sheets.length} sheet(s) from Excel`);
        // Show warnings if any (e.g., AutoFilter parsing issues)
        if (data.warnings && data.warnings.length > 0) {
          data.warnings.forEach(w => toast.warning(w, { duration: 6000 }));
        }
      } else if (extension === 'csv') {
        // CSV is handled as Excel with single sheet
        const data = await parseExcelFile(file);
        onFileUploaded('csv', data);
        toast.success(`Loaded CSV file with ${data.sheets[0]?.rows.length || 0} rows`);
        if (data.warnings && data.warnings.length > 0) {
          data.warnings.forEach(w => toast.warning(w, { duration: 6000 }));
        }
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file';
      setError(message);
      setFileName(null);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [maxSizeMB, onFileUploaded]);

  const handlePastedText = useCallback(async () => {
    if (!pastedText.trim()) {
      setError('Please paste some data first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmed = pastedText.trim();
      
      // Try to detect if it's JSON
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const rawData = JSON.parse(trimmed);
        const data = parseJsonString(trimmed, 'pasted_data');
        if (data.tables.length === 0) {
          throw new Error('No valid data found in pasted JSON');
        }
        onFileUploaded('json', data, rawData, 'pasted_data');
        setFileName('pasted_data.json');
        toast.success(`Loaded ${data.tables.length} table(s) from pasted JSON`);
      } else {
      // Assume it's CSV
        const lines = trimmed.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV must have at least a header row and one data row');
        }
        
        // Parse CSV manually
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const rows = lines.map(line => parseCSVLine(line));
        const headers = rows[0] || [];
        const data: ExcelData = {
          fileName: 'pasted_data.csv',
          sheets: [{
            name: 'Sheet1',
            headers,
            rows,
            headerRowIndex: 0
          }]
        };
        
        onFileUploaded('csv', data);
        setFileName('pasted_data.csv');
        toast.success(`Loaded CSV with ${rows.length} rows from pasted text`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse pasted data';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [pastedText, onFileUploaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input value to allow re-selecting same file
    e.target.value = '';
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setFileName(null);
    setError(null);
    setPastedText('');
  }, []);

  const handleProjectSelection = useCallback(async (selection: ProjectSelectionResult) => {
    setProjectSelectorOpen(false);
    
    const artifacts = selection.artifacts || [];
    
    if (artifacts.length === 0) {
      toast.error('No artifacts selected');
      return;
    }
    
    // Take the first artifact with content
    const artifact = artifacts.find((a: any) => a.content?.trim());
    if (!artifact) {
      toast.error('Selected artifact has no content');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const trimmed = artifact.content.trim();
      const artifactName = artifact.title || artifact.ai_title || 'artifact_data';
      const cleanName = artifactName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      // Detect JSON or CSV (same logic as handlePastedText)
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const rawData = JSON.parse(trimmed);
        const data = parseJsonString(trimmed, cleanName);
        if (data.tables.length === 0) {
          throw new Error('No valid data found in artifact JSON');
        }
        onFileUploaded('json', data, rawData, cleanName);
        setFileName(`${artifactName} (artifact)`);
        toast.success(`Loaded ${data.tables.length} table(s) from artifact`);
      } else {
        // Assume CSV - reuse existing CSV parsing logic
        const lines = trimmed.split('\n').filter((line: string) => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV must have at least a header row and one data row');
        }
        
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const rows = lines.map((line: string) => parseCSVLine(line));
        const headers = rows[0] || [];
        const data: ExcelData = {
          fileName: `${cleanName}.csv`,
          sheets: [{
            name: 'Sheet1',
            headers,
            rows,
            headerRowIndex: 0
          }]
        };
        
        onFileUploaded('csv', data);
        setFileName(`${artifactName} (artifact)`);
        toast.success(`Loaded CSV with ${rows.length} rows from artifact`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse artifact data';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [onFileUploaded]);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'paste' | 'project')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Paste Text
          </TabsTrigger>
          <TabsTrigger 
            value="project" 
            className="flex items-center gap-2"
            disabled={!projectId}
          >
            <FolderOpen className="h-4 w-4" />
            Project Elements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-8 transition-colors",
              isDragging && "border-primary bg-primary/5",
              !isDragging && !error && "border-muted-foreground/30 hover:border-muted-foreground/50",
              error && "border-destructive bg-destructive/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={accept}
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />

            <div className="flex flex-col items-center justify-center gap-4 text-center pointer-events-none">
              {isLoading ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Parsing file...</p>
                </>
              ) : fileName ? (
                <>
                  <div className="flex items-center gap-2">
                    {fileName.endsWith('.json') ? (
                      <FileJson className="h-8 w-8 text-primary" />
                    ) : (
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                    )}
                    <span className="font-medium">{fileName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    File loaded successfully. Click Next to continue.
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports Excel (.xlsx, .xls), CSV, and JSON files up to {maxSizeMB}MB
                    </p>
                  </div>
                </>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4 flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <p className="text-sm text-muted-foreground shrink-0">
              Paste CSV or JSON data directly. For CSV, include the header row.
            </p>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Paste your data here...

CSV example:
name,email,age
John,john@example.com,30
Jane,jane@example.com,25

JSON example:
[{"name": "John", "email": "john@example.com"}, {"name": "Jane", "email": "jane@example.com"}]`}
              className="flex-1 min-h-[300px] font-mono text-sm resize-none"
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Data loaded successfully from pasted text</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearFile}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button 
              onClick={handlePastedText} 
              disabled={isLoading || !pastedText.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Parse Pasted Data
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="project" className="mt-4">
          <div className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-lg border-muted-foreground/30">
            <FolderOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Select from Project</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose an artifact containing JSON or CSV data
              </p>
            </div>
            <Button onClick={() => setProjectSelectorOpen(true)} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Browse Project Elements
                </>
              )}
            </Button>
            
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Loaded from: {fileName}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearFile}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Supported Formats */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-4 w-4" />
          <span>Excel / CSV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileJson className="h-4 w-4" />
          <span>JSON</span>
        </div>
      </div>

      {projectId && (
        <ProjectSelector
          projectId={projectId}
          shareToken={shareToken || null}
          open={projectSelectorOpen}
          onClose={() => setProjectSelectorOpen(false)}
          onConfirm={handleProjectSelection}
        />
      )}
    </div>
  );
}