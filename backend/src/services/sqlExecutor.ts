import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

const MAX_ROWS = 100;
const QUERY_TIMEOUT_MS = 10000;

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE',
  'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', 'COPY', 'VACUUM', 
  'REINDEX', 'CLUSTER', 'COMMENT', 'LOCK', 'SET', 'RESET', 'DISCARD',
  'PREPARE', 'DEALLOCATE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'RELEASE', 'LOAD', 'IMPORT', 'EXPORT', 'NOTIFY', 'LISTEN', 'UNLISTEN'
];

const FORBIDDEN_PATTERNS = [
  /;\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)/i,
  /--/,
  /\/\*/,
  /INTO\s+OUTFILE/i,
  /LOAD_FILE/i,
  /pg_sleep/i,
  /pg_terminate_backend/i,
  /pg_cancel_backend/i,
  /information_schema\.role/i,
  /pg_shadow/i,
  /pg_authid/i
];

export interface SQLExecutionResult {
  success: boolean;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
  query?: string;
}

export interface SQLAuditLog {
  timestamp: Date;
  query: string;
  userId?: string;
  success: boolean;
  rowCount?: number;
  error?: string;
  executionTimeMs: number;
}

const auditLogs: SQLAuditLog[] = [];

function validateQuery(query: string): { valid: boolean; error?: string } {
  const trimmedQuery = query.trim().toUpperCase();
  
  if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }
  
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query) && keyword !== 'SELECT') {
      if (trimmedQuery.indexOf(keyword) > 0) {
        return { valid: false, error: `Forbidden keyword detected: ${keyword}` };
      }
    }
  }
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(query)) {
      return { valid: false, error: "Query contains forbidden pattern" };
    }
  }
  
  const statementCount = (query.match(/;/g) || []).length;
  if (statementCount > 1) {
    return { valid: false, error: "Only single statements are allowed" };
  }
  
  return { valid: true };
}

export async function executeReadOnlySQL(
  query: string,
  userId?: string
): Promise<SQLExecutionResult> {
  const startTime = Date.now();
  
  const validation = validateQuery(query);
  if (!validation.valid) {
    const log: SQLAuditLog = {
      timestamp: new Date(),
      query,
      userId,
      success: false,
      error: validation.error,
      executionTimeMs: Date.now() - startTime
    };
    auditLogs.push(log);
    
    return { success: false, error: validation.error, query };
  }
  
  try {
    const limitedQuery = ensureLimit(query.trim().replace(/;$/, ''));
    
    const result = await Promise.race([
      db.execute(sql.raw(limitedQuery)),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout exceeded')), QUERY_TIMEOUT_MS)
      )
    ]);
    
    const executionTimeMs = Date.now() - startTime;
    const rows = (result as any).rows || [];
    
    const log: SQLAuditLog = {
      timestamp: new Date(),
      query: limitedQuery,
      userId,
      success: true,
      rowCount: rows.length,
      executionTimeMs
    };
    auditLogs.push(log);
    
    if (auditLogs.length > 1000) {
      auditLogs.splice(0, auditLogs.length - 1000);
    }
    
    return {
      success: true,
      data: rows,
      rowCount: rows.length,
      executionTimeMs,
      query: limitedQuery
    };
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error occurred';
    
    const log: SQLAuditLog = {
      timestamp: new Date(),
      query,
      userId,
      success: false,
      error: errorMessage,
      executionTimeMs
    };
    auditLogs.push(log);
    
    return {
      success: false,
      error: errorMessage,
      executionTimeMs,
      query
    };
  }
}

function ensureLimit(query: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let limitStart = -1;
  let limitEnd = -1;
  let limitValue = 0;
  
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const prevChar = i > 0 ? query[i - 1] : '';
    
    if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    
    if (!inSingleQuote && !inDoubleQuote) {
      if (query.slice(i, i + 5).toUpperCase() === 'LIMIT') {
        const before = i === 0 ? ' ' : query[i - 1];
        if (/\s/.test(before) || before === '(' || before === ')' || before === ';') {
          let j = i + 5;
          while (j < query.length && /\s/.test(query[j])) j++;
          
          let numStart = j;
          while (j < query.length && /\d/.test(query[j])) j++;
          
          if (j > numStart) {
            limitStart = i;
            limitEnd = j;
            limitValue = parseInt(query.slice(numStart, j), 10);
            break;
          }
        }
      }
    }
  }
  
  if (limitStart !== -1) {
    if (limitValue > MAX_ROWS) {
      return query.slice(0, limitStart) + `LIMIT ${MAX_ROWS}` + query.slice(limitEnd);
    }
    return query;
  }
  
  return `${query} LIMIT ${MAX_ROWS}`;
}

export function getAuditLogs(limit: number = 100): SQLAuditLog[] {
  return auditLogs.slice(-limit);
}

export function formatResultsAsMarkdown(result: SQLExecutionResult): string {
  if (!result.success) {
    return `**Query Error:** ${result.error}`;
  }
  
  if (!result.data || result.data.length === 0) {
    return "No results found.";
  }
  
  const columns = Object.keys(result.data[0]);
  
  let markdown = `| ${columns.join(' | ')} |\n`;
  markdown += `| ${columns.map(() => '---').join(' | ')} |\n`;
  
  for (const row of result.data) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val).substring(0, 100);
    });
    markdown += `| ${values.join(' | ')} |\n`;
  }
  
  markdown += `\n*${result.rowCount} rows returned in ${result.executionTimeMs}ms*`;
  
  return markdown;
}
