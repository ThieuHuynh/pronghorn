import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Download, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight,
  Copy,
  Check,
  X,
  FileJson,
  FileSpreadsheet,
  FileCode
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QueryResultsViewerProps {
  columns: string[];
  rows: any[];
  totalRows?: number;
  executionTime?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (offset: number) => void;
  onExport?: (format: 'json' | 'csv' | 'sql') => void;
}

export function QueryResultsViewer({
  columns,
  rows,
  totalRows,
  executionTime,
  limit = 100,
  offset = 0,
  onPageChange,
  onExport,
}: QueryResultsViewerProps) {
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Filter and sort rows
  const processedRows = useMemo(() => {
    let result = [...rows];

    // Apply filter
    if (filterColumn && filterValue) {
      result = result.filter((row) => {
        const cellValue = String(row[filterColumn] ?? "").toLowerCase();
        return cellValue.includes(filterValue.toLowerCase());
      });
    }

    // Apply sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [rows, filterColumn, filterValue, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleCopyCell = (value: any, cellId: string) => {
    const textValue = value === null ? 'NULL' : String(value);
    navigator.clipboard.writeText(textValue);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const handleCopyRow = (row: any) => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    toast.success("Row copied to clipboard");
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = totalRows ? Math.ceil(totalRows / limit) : 1;

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No results to display</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-mono">
            {processedRows.length} rows
          </Badge>
          {executionTime !== undefined && (
            <span className="text-xs text-muted-foreground">
              {executionTime}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filter
                {filterColumn && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filterColumn}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-2 space-y-2">
                <select
                  className="w-full p-1.5 text-sm border rounded bg-background"
                  value={filterColumn || ""}
                  onChange={(e) => setFilterColumn(e.target.value || null)}
                >
                  <option value="">Select column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <Input
                  placeholder="Filter value..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="h-8"
                />
                {filterColumn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterColumn(null);
                      setFilterValue("");
                    }}
                    className="w-full h-7"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear filter
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport('json')}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('sql')}>
                  <FileCode className="h-4 w-4 mr-2" />
                  Export as SQL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70"
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-[200px]">{col}</span>
                      {sortColumn === col ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processedRows.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className="border-b border-border/50 hover:bg-muted/30 group"
                >
                  <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{offset + rowIndex + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleCopyRow(row)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  {columns.map((col) => {
                    const cellId = `${rowIndex}-${col}`;
                    const value = row[col];
                    const displayValue = formatCellValue(value);
                    const isNull = value === null || value === undefined;

                    return (
                      <td
                        key={col}
                        className={cn(
                          "px-3 py-1.5 font-mono text-xs max-w-[300px] truncate cursor-pointer hover:bg-muted/50",
                          isNull && "text-muted-foreground italic"
                        )}
                        onClick={() => handleCopyCell(value, cellId)}
                        title={displayValue}
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate">{displayValue}</span>
                          {copiedCell === cellId && (
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Pagination */}
      {totalRows && totalRows > limit && onPageChange && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, totalRows)} of {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(offset - limit)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(offset + limit)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
