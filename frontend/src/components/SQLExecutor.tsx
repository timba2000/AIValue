import { useState } from "react";
import { Play, Loader2, CheckCircle, XCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface SQLExecutorProps {
  sql: string;
  onResultReceived?: (result: string) => void;
}

interface SQLResult {
  success: boolean;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
}

export function SQLExecutor({ sql, onResultReceived }: SQLExecutorProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const executeQuery = async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/execute-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: sql }),
      });

      const data = await response.json();
      setResult(data);
      setExpanded(true);

      if (data.success && onResultReceived) {
        const markdown = formatAsMarkdown(data);
        onResultReceived(markdown);
      }
    } catch (err) {
      setResult({
        success: false,
        error: "Failed to execute query",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const formatAsMarkdown = (data: SQLResult): string => {
    if (!data.success) {
      return `**Error:** ${data.error}`;
    }
    if (!data.data || data.data.length === 0) {
      return "No results found.";
    }

    const columns = Object.keys(data.data[0]);
    let md = `| ${columns.join(" | ")} |\n`;
    md += `| ${columns.map(() => "---").join(" | ")} |\n`;

    for (const row of data.data) {
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return val.toString();
        if (typeof val === "object") return JSON.stringify(val);
        return String(val).substring(0, 50);
      });
      md += `| ${values.join(" | ")} |\n`;
    }

    return md;
  };

  return (
    <div className="mt-2 border border-border rounded-lg overflow-hidden bg-background/50">
      <div className="flex items-center justify-between px-3 py-2 bg-accent/50 border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>SQL Query</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={executeQuery}
          disabled={isExecuting}
          className="h-7 text-xs gap-1"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Running...
            </>
          ) : result ? (
            result.success ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-500" />
                Run Again
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-red-500" />
                Retry
              </>
            )
          ) : (
            <>
              <Play className="h-3 w-3" />
              Run Query
            </>
          )}
        </Button>
      </div>

      {result && expanded && (
        <div className="p-3">
          {result.success ? (
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>
                  {result.rowCount} rows returned in {result.executionTimeMs}ms
                </span>
              </div>
              {result.data && result.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-accent">
                        {Object.keys(result.data[0]).map((col) => (
                          <th
                            key={col}
                            className="border border-border px-2 py-1 text-left font-medium"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="hover:bg-accent/50">
                          {Object.values(row).map((val, cidx) => (
                            <td
                              key={cidx}
                              className="border border-border px-2 py-1"
                            >
                              {val === null
                                ? "NULL"
                                : typeof val === "object"
                                ? JSON.stringify(val)
                                : String(val).substring(0, 100)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.data.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing first 20 of {result.data.length} rows
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No rows returned</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <XCircle className="h-3 w-3" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function extractSQLBlocks(content: string): { before: string; sql: string; after: string }[] {
  const blocks: { before: string; sql: string; after: string }[] = [];
  const sqlBlockRegex = /```sql\s*([\s\S]*?)```/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = sqlBlockRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    const sql = match[1].trim();
    lastIndex = match.index + match[0].length;
    
    blocks.push({
      before,
      sql,
      after: "",
    });
  }
  
  if (blocks.length > 0) {
    blocks[blocks.length - 1].after = content.slice(lastIndex);
  }
  
  return blocks;
}

export function hasSQLBlocks(content: string): boolean {
  return /```sql\s*[\s\S]*?```/i.test(content);
}
