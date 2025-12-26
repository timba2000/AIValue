import { Router, Request, Response } from "express";
import { generateChatResponse, generateChatResponseStream, ChatMessage, AIConfig } from "../services/aiService.js";
import { db } from "../db/client.js";
import { companies, businessUnits, processes, painPoints, useCases, painPointUseCases, aiConversations, aiMessages, taxonomyCategories, processPainPoints, users } from "../db/schema.js";
import { eq, desc, ilike, or, and, inArray, sql } from "drizzle-orm";
import { getUser } from "../simpleAuth.js";
import { executeReadOnlySQL, formatResultsAsMarkdown, getAuditLogs, SQLExecutionResult } from "../services/sqlExecutor.js";

const router = Router();

const MAX_CONTEXT_CHARS = 40000;
const MAX_HISTORY_MESSAGES = 10;
const CACHE_TTL_MS = 2 * 60 * 1000;

let cachedUnfilteredContext: string | null = null;
let unfilteredCacheTimestamp: number = 0;

const DATABASE_SCHEMA_DESCRIPTION = `
=== DATABASE SCHEMA ===
You have access to the following tables and relationships:

TABLES:
1. companies (id, name, industry, anzsic)
   - Top-level entities representing client organizations

2. business_units (id, company_id, parent_id, name, description, fte)
   - Departments/divisions within companies
   - Hierarchical: parent_id allows 3-level nesting
   - company_id links to companies table

3. processes (id, business_id, business_unit_id, name, description, volume, volume_unit, fte, owner, systems_used)
   - Business processes within companies/BUs
   - business_id = company, business_unit_id = optional BU assignment

4. pain_points (id, statement, impact_type[], business_impact, magnitude, frequency, time_per_unit, total_hours_per_month, fte_count, root_cause, workarounds, dependencies, risk_level, effort_solving, taxonomy_level1_id, taxonomy_level2_id, taxonomy_level3_id, company_id, business_unit_id)
   - Problems/inefficiencies identified in processes
   - Can be linked to company and/or business_unit

5. use_cases (id, name, solution_provider, problem_to_solve, solution_overview, complexity, data_requirements[], systems_impacted, risks, estimated_delivery_time, cost_range, confidence_level, process_id, company_id, business_unit_id)
   - Solutions/automation opportunities

6. pain_point_use_cases (pain_point_id, use_case_id, percentage_solved, notes)
   - Many-to-many linking pain points to solutions

7. process_pain_points (process_id, pain_point_id)
   - Links pain points to processes

8. taxonomy_categories (id, name, parent_id, level)
   - Hierarchical categorization (L1 > L2 > L3)

RELATIONSHIPS:
- Companies → Business Units (one-to-many)
- Business Units → Processes (one-to-many)
- Processes → Pain Points (many-to-many via process_pain_points)
- Pain Points → Use Cases (many-to-many via pain_point_use_cases)
- Pain Points can belong directly to Company and/or Business Unit

COMMON QUERIES YOU CAN ANSWER:
- Rankings: "Which BU has the most pain points?", "Top processes by hours"
- Counts: "How many pain points per company?", "Total solutions available"
- Aggregates: "Total hours/month by business unit", "Average opportunity score by company"
- Comparisons: "Compare pain points across BUs", "Which category has most issues"

SQL EXECUTION CAPABILITY:
You can execute read-only SQL queries against the database. When a user asks an analytical question that requires database data:
1. Generate a valid PostgreSQL SELECT query
2. Wrap the query in a code block with sql language tag
3. The system will detect and execute the query, then provide results

Example format for executing SQL:
\`\`\`sql
SELECT bu.name, COUNT(pp.id) as pain_point_count
FROM business_units bu
LEFT JOIN pain_points pp ON pp.business_unit_id = bu.id
GROUP BY bu.id, bu.name
ORDER BY pain_point_count DESC
LIMIT 10
\`\`\`

The query results will be automatically executed and returned. Only SELECT/WITH queries are allowed (no INSERT, UPDATE, DELETE, etc.).
=== END SCHEMA ===
`;

interface AnalyticalQueryParams {
  targetEntity: 'business_unit' | 'company' | 'process' | 'pain_point' | 'solution' | 'category' | null;
  metric: 'count' | 'hours' | 'opportunity_score' | null;
  statusFilter: 'linked' | 'unlinked' | 'all';
  rankingOrder: 'desc' | 'asc';
  limit: number;
  groupBy: 'business_unit' | 'company' | 'process' | 'category' | null;
  specificEntityName: string | null;
}

function parseAnalyticalQuestion(question: string): AnalyticalQueryParams {
  const lowerQ = question.toLowerCase();
  
  const params: AnalyticalQueryParams = {
    targetEntity: null,
    metric: null,
    statusFilter: 'all',
    rankingOrder: 'desc',
    limit: 15,
    groupBy: null,
    specificEntityName: null
  };
  
  if (lowerQ.includes('business unit') || lowerQ.includes('bu ') || lowerQ.includes('bus ') || lowerQ.includes('team') || lowerQ.includes('department')) {
    params.targetEntity = 'business_unit';
  } else if (lowerQ.includes('company') || lowerQ.includes('companies') || lowerQ.includes('organization')) {
    params.targetEntity = 'company';
  } else if (lowerQ.includes('process') || lowerQ.includes('processes')) {
    params.targetEntity = 'process';
  } else if (lowerQ.includes('solution') || lowerQ.includes('use case')) {
    params.targetEntity = 'solution';
  } else if (lowerQ.includes('category') || lowerQ.includes('taxonomy')) {
    params.targetEntity = 'category';
  } else if (lowerQ.includes('pain point') || lowerQ.includes('pain points')) {
    params.targetEntity = 'pain_point';
  }
  
  if (lowerQ.includes('hour') || lowerQ.includes('time')) {
    params.metric = 'hours';
  } else if (lowerQ.includes('score') || lowerQ.includes('opportunity')) {
    params.metric = 'opportunity_score';
  } else {
    params.metric = 'count';
  }
  
  const unlinkedPatterns = [
    /\bunlinked\b/i,
    /\bnot\s+linked\b/i,
    /\bnot\s+yet\s+linked\b/i,
    /\bwithout\s+solutions?\b/i,
    /\bno\s+solutions?\b/i,
    /\bno\s+linked\b/i,
    /\bwithout\s+linked\b/i,
    /\bhaven't\s+been\s+linked\b/i,
    /\bhasn't\s+been\s+linked\b/i,
    /\bhas\s+not\s+been\s+linked\b/i,
    /\bhave\s+not\s+been\s+linked\b/i,
    /\baren't\s+linked\b/i,
    /\bisn't\s+linked\b/i,
    /\bare\s+not\s+linked\b/i,
    /\bis\s+not\s+linked\b/i,
    /\bnot\s+\w*\s*linked\s+to\b/i,
  ];
  
  const isUnlinked = unlinkedPatterns.some(pattern => pattern.test(lowerQ));
  
  if (isUnlinked) {
    params.statusFilter = 'unlinked';
  } else if ((lowerQ.includes('linked') || lowerQ.includes('with solution')) && !lowerQ.includes('unlinked')) {
    params.statusFilter = 'linked';
  }
  
  if (lowerQ.includes('least') || lowerQ.includes('fewest') || lowerQ.includes('lowest') || lowerQ.includes('bottom')) {
    params.rankingOrder = 'asc';
  }
  
  const topMatch = lowerQ.match(/top\s+(\d+)/);
  if (topMatch) {
    params.limit = Math.min(parseInt(topMatch[1], 10), 50);
  }
  
  if (lowerQ.includes('by business unit') || lowerQ.includes('per business unit') || lowerQ.includes('by bu') || lowerQ.includes('per bu')) {
    params.groupBy = 'business_unit';
  } else if (lowerQ.includes('by company') || lowerQ.includes('per company')) {
    params.groupBy = 'company';
  } else if (lowerQ.includes('by process') || lowerQ.includes('per process')) {
    params.groupBy = 'process';
  } else if (lowerQ.includes('by category') || lowerQ.includes('per category')) {
    params.groupBy = 'category';
  }
  
  return params;
}

async function executeFlexibleAnalyticalQuery(params: AnalyticalQueryParams): Promise<string | null> {
  try {
    if (params.targetEntity === 'business_unit' && params.statusFilter !== 'all') {
      const statusCondition = params.statusFilter === 'linked' ? 'true' : 'false';
      const results = await db.execute<{
        bu_id: string;
        bu_name: string;
        company_name: string;
        pain_point_count: string;
        total_hours: string;
      }>(
        sql`WITH bu_pp_stats AS (
          SELECT 
            bu.id as bu_id,
            bu.name as bu_name,
            c.name as company_name,
            pp.id as pp_id,
            pp.total_hours_per_month,
            CASE WHEN EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id) THEN true ELSE false END as is_linked
          FROM business_units bu
          LEFT JOIN companies c ON bu.company_id = c.id
          LEFT JOIN pain_points pp ON pp.business_unit_id = bu.id
        )
        SELECT 
          bu_id,
          bu_name,
          company_name,
          COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)})::text as pain_point_count,
          COALESCE(SUM(total_hours_per_month) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}), 0)::text as total_hours
        FROM bu_pp_stats
        GROUP BY bu_id, bu_name, company_name
        HAVING COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) > 0
        ORDER BY COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) ${sql.raw(params.rankingOrder === 'desc' ? 'DESC' : 'ASC')}
        LIMIT ${params.limit}`
      );
      
      if (results.rows.length === 0) {
        return `No business units found with ${params.statusFilter} pain points.`;
      }
      
      const statusLabel = params.statusFilter === 'linked' ? 'Linked' : 'Unlinked';
      let result = `BUSINESS UNITS WITH ${statusLabel.toUpperCase()} PAIN POINTS:\n\n`;
      result += `| Rank | Business Unit | Company | ${statusLabel} Pain Points | Hours/Month |\n`;
      result += `|------|---------------|---------|${'-'.repeat(statusLabel.length + 13)}|-------------|\n`;
      
      results.rows.forEach((row, idx) => {
        const shortId = row.bu_id.substring(0, 8);
        result += `| ${idx + 1} | [BU:${shortId}] ${row.bu_name} | ${row.company_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      const topBu = results.rows[0];
      result += `\n**Summary:** [BU:${topBu.bu_id.substring(0, 8)}] ${topBu.bu_name} has the most ${params.statusFilter} pain points (${topBu.pain_point_count}).`;
      
      return result;
    }
    
    if (params.targetEntity === 'company' && params.statusFilter !== 'all') {
      const statusCondition = params.statusFilter === 'linked' ? 'true' : 'false';
      const results = await db.execute<{
        co_id: string;
        co_name: string;
        pain_point_count: string;
        total_hours: string;
      }>(
        sql`WITH co_pp_stats AS (
          SELECT 
            c.id as co_id,
            c.name as co_name,
            pp.id as pp_id,
            pp.total_hours_per_month,
            CASE WHEN EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id) THEN true ELSE false END as is_linked
          FROM companies c
          LEFT JOIN pain_points pp ON pp.company_id = c.id
        )
        SELECT 
          co_id,
          co_name,
          COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)})::text as pain_point_count,
          COALESCE(SUM(total_hours_per_month) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}), 0)::text as total_hours
        FROM co_pp_stats
        GROUP BY co_id, co_name
        HAVING COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) > 0
        ORDER BY COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) ${sql.raw(params.rankingOrder === 'desc' ? 'DESC' : 'ASC')}
        LIMIT ${params.limit}`
      );
      
      if (results.rows.length === 0) {
        return `No companies found with ${params.statusFilter} pain points.`;
      }
      
      const statusLabel = params.statusFilter === 'linked' ? 'Linked' : 'Unlinked';
      let result = `COMPANIES WITH ${statusLabel.toUpperCase()} PAIN POINTS:\n\n`;
      result += `| Rank | Company | ${statusLabel} Pain Points | Hours/Month |\n`;
      result += `|------|---------|${'-'.repeat(statusLabel.length + 13)}|-------------|\n`;
      
      results.rows.forEach((row, idx) => {
        const shortId = row.co_id.substring(0, 8);
        result += `| ${idx + 1} | [CO:${shortId}] ${row.co_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    if (params.targetEntity === 'process' && params.statusFilter !== 'all') {
      const statusCondition = params.statusFilter === 'linked' ? 'true' : 'false';
      const results = await db.execute<{
        proc_id: string;
        proc_name: string;
        bu_name: string;
        pain_point_count: string;
        total_hours: string;
      }>(
        sql`WITH proc_pp_stats AS (
          SELECT 
            p.id as proc_id,
            p.name as proc_name,
            COALESCE(bu.name, 'Unassigned') as bu_name,
            pp.id as pp_id,
            pp.total_hours_per_month,
            CASE WHEN EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id) THEN true ELSE false END as is_linked
          FROM processes p
          LEFT JOIN business_units bu ON p.business_unit_id = bu.id
          LEFT JOIN process_pain_points ppp ON ppp.process_id = p.id
          LEFT JOIN pain_points pp ON pp.id = ppp.pain_point_id
        )
        SELECT 
          proc_id,
          proc_name,
          bu_name,
          COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)})::text as pain_point_count,
          COALESCE(SUM(total_hours_per_month) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}), 0)::text as total_hours
        FROM proc_pp_stats
        GROUP BY proc_id, proc_name, bu_name
        HAVING COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) > 0
        ORDER BY COUNT(DISTINCT pp_id) FILTER (WHERE is_linked = ${sql.raw(statusCondition)}) ${sql.raw(params.rankingOrder === 'desc' ? 'DESC' : 'ASC')}
        LIMIT ${params.limit}`
      );
      
      if (results.rows.length === 0) {
        return `No processes found with ${params.statusFilter} pain points.`;
      }
      
      const statusLabel = params.statusFilter === 'linked' ? 'Linked' : 'Unlinked';
      let result = `PROCESSES WITH ${statusLabel.toUpperCase()} PAIN POINTS:\n\n`;
      result += `| Rank | Process | Business Unit | ${statusLabel} Pain Points | Hours/Month |\n`;
      result += `|------|---------|---------------|${'-'.repeat(statusLabel.length + 13)}|-------------|\n`;
      
      results.rows.forEach((row, idx) => {
        const shortId = row.proc_id.substring(0, 8);
        result += `| ${idx + 1} | [PROC:${shortId}] ${row.proc_name} | ${row.bu_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error("[AI] Flexible analytical query error:", error);
    return null;
  }
}

async function findBusinessUnitByName(searchTerms: string[]): Promise<{ id: string; name: string } | null> {
  try {
    const allBus = await db.execute<{ id: string; name: string }>(
      sql`SELECT id, name FROM business_units`
    );
    
    for (const bu of allBus.rows) {
      const buNameLower = bu.name.toLowerCase();
      if (searchTerms.some(term => buNameLower.includes(term))) {
        return bu;
      }
    }
    return null;
  } catch (error) {
    console.error("[AI] Error finding business unit:", error);
    return null;
  }
}

function extractSearchTerms(question: string): string[] {
  const stopWords = ['the', 'for', 'and', 'how', 'many', 'pain', 'points', 'linked', 'unlinked', 'what', 'are', 'in', 'of', 'to', 'a', 'an', 'is', 'has', 'have', 'team', 'department', 'unit', 'business', 'with', 'without', 'solutions'];
  const words = question.toLowerCase().split(/\s+/);
  return words.filter(word => word.length > 2 && !stopWords.includes(word));
}

async function executeAnalyticalQuery(question: string): Promise<string | null> {
  try {
    const lowerQuestion = question.toLowerCase();
    
    const params = parseAnalyticalQuestion(question);
    const flexibleResult = await executeFlexibleAnalyticalQuery(params);
    if (flexibleResult) {
      return flexibleResult;
    }
    
    if ((lowerQuestion.includes('linked') || lowerQuestion.includes('unlinked') || lowerQuestion.includes('without solution')) && 
        (lowerQuestion.includes('pain point') || lowerQuestion.includes('pain points'))) {
      const searchTerms = extractSearchTerms(question);
      const matchedBu = await findBusinessUnitByName(searchTerms);
      
      if (matchedBu) {
        const linkedStats = await db.execute<{ 
          total_count: string; 
          linked_count: string; 
          unlinked_count: string;
          total_hours: string;
          linked_hours: string;
          unlinked_hours: string;
        }>(
          sql`WITH pp_link_status AS (
            SELECT 
              pp.id,
              pp.total_hours_per_month,
              CASE WHEN EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id) THEN true ELSE false END as is_linked
            FROM pain_points pp
            WHERE pp.business_unit_id = ${matchedBu.id}
          )
          SELECT 
            COUNT(*)::text as total_count,
            COUNT(*) FILTER (WHERE is_linked = true)::text as linked_count,
            COUNT(*) FILTER (WHERE is_linked = false)::text as unlinked_count,
            COALESCE(SUM(total_hours_per_month), 0)::text as total_hours,
            COALESCE(SUM(total_hours_per_month) FILTER (WHERE is_linked = true), 0)::text as linked_hours,
            COALESCE(SUM(total_hours_per_month) FILTER (WHERE is_linked = false), 0)::text as unlinked_hours
          FROM pp_link_status`
        );
        
        const row = linkedStats.rows[0];
        const shortId = matchedBu.id.substring(0, 8);
        
        let result = `PAIN POINTS FOR [BU:${shortId}] ${matchedBu.name}:\n\n`;
        result += "| Status | Count | Hours/Month |\n";
        result += "|--------|-------|-------------|\n";
        result += `| Total | ${row.total_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
        result += `| Linked (with solutions) | ${row.linked_count} | ${parseFloat(row.linked_hours).toFixed(1)} |\n`;
        result += `| Unlinked (no solutions) | ${row.unlinked_count} | ${parseFloat(row.unlinked_hours).toFixed(1)} |\n`;
        
        result += `\n**Summary:** [BU:${shortId}] ${matchedBu.name} has ${row.total_count} pain points total. ${row.linked_count} are linked to solutions and ${row.unlinked_count} are unlinked (without solutions).`;
        
        return result;
      }
      
      const globalLinkedStats = await db.execute<{ 
        total_count: string; 
        linked_count: string; 
        unlinked_count: string;
        total_hours: string;
      }>(
        sql`WITH pp_link_status AS (
          SELECT 
            pp.id,
            pp.total_hours_per_month,
            CASE WHEN EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id) THEN true ELSE false END as is_linked
          FROM pain_points pp
        )
        SELECT 
          COUNT(*)::text as total_count,
          COUNT(*) FILTER (WHERE is_linked = true)::text as linked_count,
          COUNT(*) FILTER (WHERE is_linked = false)::text as unlinked_count,
          COALESCE(SUM(total_hours_per_month), 0)::text as total_hours
        FROM pp_link_status`
      );
      
      const row = globalLinkedStats.rows[0];
      
      let result = "PAIN POINTS - LINKED VS UNLINKED (ALL):\n\n";
      result += "| Status | Count | Percentage |\n";
      result += "|--------|-------|------------|\n";
      const total = parseInt(row.total_count);
      const linked = parseInt(row.linked_count);
      const unlinked = parseInt(row.unlinked_count);
      const linkedPct = total > 0 ? ((linked / total) * 100).toFixed(1) : '0';
      const unlinkedPct = total > 0 ? ((unlinked / total) * 100).toFixed(1) : '0';
      result += `| Total | ${row.total_count} | 100% |\n`;
      result += `| Linked (with solutions) | ${row.linked_count} | ${linkedPct}% |\n`;
      result += `| Unlinked (no solutions) | ${row.unlinked_count} | ${unlinkedPct}% |\n`;
      
      result += `\n**Summary:** There are ${row.total_count} pain points total. ${row.linked_count} (${linkedPct}%) are linked to solutions and ${row.unlinked_count} (${unlinkedPct}%) are unlinked.`;
      
      return result;
    }
    
    if (lowerQuestion.includes('business unit') && (lowerQuestion.includes('most') || lowerQuestion.includes('ranking') || lowerQuestion.includes('top') || lowerQuestion.includes('highest'))) {
      const buRankings = await db.execute<{ bu_id: string; bu_name: string; company_name: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          bu.id as bu_id,
          bu.name as bu_name, 
          c.name as company_name,
          COUNT(pp.id)::text as pain_point_count,
          COALESCE(SUM(pp.total_hours_per_month), 0)::text as total_hours
        FROM business_units bu
        LEFT JOIN companies c ON bu.company_id = c.id
        LEFT JOIN pain_points pp ON pp.business_unit_id = bu.id
        GROUP BY bu.id, bu.name, c.name
        ORDER BY COUNT(pp.id) DESC
        LIMIT 15`
      );
      
      if (buRankings.rows.length === 0) {
        return "No business units found with pain points assigned.";
      }
      
      let result = "BUSINESS UNIT RANKINGS BY PAIN POINTS:\n\n";
      result += "| Rank | Business Unit | Company | Pain Points | Hours/Month |\n";
      result += "|------|---------------|---------|-------------|-------------|\n";
      
      buRankings.rows.forEach((row, idx) => {
        const shortId = row.bu_id.substring(0, 8);
        result += `| ${idx + 1} | [BU:${shortId}] ${row.bu_name} | ${row.company_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      const topBu = buRankings.rows[0];
      result += `\n**Answer:** [BU:${topBu.bu_id.substring(0, 8)}] ${topBu.bu_name} (${topBu.company_name}) has the most pain points with ${topBu.pain_point_count} pain points and ${parseFloat(topBu.total_hours).toFixed(1)} hours/month total.`;
      
      return result;
    }
    
    if (lowerQuestion.includes('process') && (lowerQuestion.includes('most') || lowerQuestion.includes('ranking') || lowerQuestion.includes('top') || lowerQuestion.includes('highest'))) {
      const procRankings = await db.execute<{ proc_id: string; proc_name: string; bu_name: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          p.id as proc_id,
          p.name as proc_name,
          COALESCE(bu.name, 'Unassigned') as bu_name,
          COUNT(pp.pain_point_id)::text as pain_point_count,
          COALESCE(SUM(pt.total_hours_per_month), 0)::text as total_hours
        FROM processes p
        LEFT JOIN business_units bu ON p.business_unit_id = bu.id
        LEFT JOIN process_pain_points pp ON pp.process_id = p.id
        LEFT JOIN pain_points pt ON pt.id = pp.pain_point_id
        GROUP BY p.id, p.name, bu.name
        ORDER BY COUNT(pp.pain_point_id) DESC
        LIMIT 15`
      );
      
      if (procRankings.rows.length === 0) {
        return "No processes found with pain points.";
      }
      
      let result = "PROCESS RANKINGS BY PAIN POINTS:\n\n";
      result += "| Rank | Process | Business Unit | Pain Points | Hours/Month |\n";
      result += "|------|---------|---------------|-------------|-------------|\n";
      
      procRankings.rows.forEach((row, idx) => {
        const shortId = row.proc_id.substring(0, 8);
        result += `| ${idx + 1} | [PROC:${shortId}] ${row.proc_name} | ${row.bu_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    if (lowerQuestion.includes('company') && (lowerQuestion.includes('most') || lowerQuestion.includes('ranking') || lowerQuestion.includes('compare') || lowerQuestion.includes('top') || lowerQuestion.includes('highest'))) {
      const companyRankings = await db.execute<{ co_id: string; co_name: string; bu_count: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          c.id as co_id,
          c.name as co_name,
          COUNT(DISTINCT bu.id)::text as bu_count,
          COUNT(pp.id)::text as pain_point_count,
          COALESCE(SUM(pp.total_hours_per_month), 0)::text as total_hours
        FROM companies c
        LEFT JOIN business_units bu ON bu.company_id = c.id
        LEFT JOIN pain_points pp ON pp.company_id = c.id
        GROUP BY c.id, c.name
        ORDER BY COUNT(pp.id) DESC
        LIMIT 15`
      );
      
      if (companyRankings.rows.length === 0) {
        return "No companies found.";
      }
      
      let result = "COMPANY RANKINGS:\n\n";
      result += "| Rank | Company | Business Units | Pain Points | Hours/Month |\n";
      result += "|------|---------|----------------|-------------|-------------|\n";
      
      companyRankings.rows.forEach((row, idx) => {
        const shortId = row.co_id.substring(0, 8);
        result += `| ${idx + 1} | [CO:${shortId}] ${row.co_name} | ${row.bu_count} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    if (lowerQuestion.includes('category') || lowerQuestion.includes('taxonomy')) {
      const categoryRankings = await db.execute<{ category_name: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          COALESCE(tc.name, 'Uncategorized') as category_name,
          COUNT(pp.id)::text as pain_point_count,
          COALESCE(SUM(pp.total_hours_per_month), 0)::text as total_hours
        FROM pain_points pp
        LEFT JOIN taxonomy_categories tc ON pp.taxonomy_level1_id = tc.id
        GROUP BY tc.name
        ORDER BY COUNT(pp.id) DESC
        LIMIT 15`
      );
      
      if (categoryRankings.rows.length === 0) {
        return "No categorized pain points found.";
      }
      
      let result = "PAIN POINTS BY CATEGORY (L1 Taxonomy):\n\n";
      result += "| Rank | Category | Pain Points | Hours/Month |\n";
      result += "|------|----------|-------------|-------------|\n";
      
      categoryRankings.rows.forEach((row, idx) => {
        result += `| ${idx + 1} | ${row.category_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    if ((lowerQuestion.includes('solution') || lowerQuestion.includes('use case')) && (lowerQuestion.includes('most') || lowerQuestion.includes('popular') || lowerQuestion.includes('top') || lowerQuestion.includes('highest'))) {
      const solutionRankings = await db.execute<{ uc_id: string; uc_name: string; provider: string; linked_count: string; avg_solved: string }>(
        sql`SELECT 
          uc.id as uc_id,
          uc.name as uc_name,
          COALESCE(uc.solution_provider, 'N/A') as provider,
          COUNT(ppuc.id)::text as linked_count,
          COALESCE(AVG(ppuc.percentage_solved), 0)::text as avg_solved
        FROM use_cases uc
        LEFT JOIN pain_point_use_cases ppuc ON ppuc.use_case_id = uc.id
        GROUP BY uc.id, uc.name, uc.solution_provider
        ORDER BY COUNT(ppuc.id) DESC
        LIMIT 15`
      );
      
      if (solutionRankings.rows.length === 0) {
        return "No solutions/use cases found.";
      }
      
      let result = "TOP SOLUTIONS BY PAIN POINTS ADDRESSED:\n\n";
      result += "| Rank | Solution | Provider | Pain Points Linked | Avg % Solved |\n";
      result += "|------|----------|----------|--------------------|--------------|\n";
      
      solutionRankings.rows.forEach((row, idx) => {
        const shortId = row.uc_id.substring(0, 8);
        result += `| ${idx + 1} | [UC:${shortId}] ${row.uc_name} | ${row.provider} | ${row.linked_count} | ${parseFloat(row.avg_solved).toFixed(0)}% |\n`;
      });
      
      return result;
    }
    
    if (lowerQuestion.includes('total') || lowerQuestion.includes('count') || lowerQuestion.includes('how many')) {
      const stats = await db.execute<{ companies: string; business_units: string; processes: string; pain_points: string; use_cases: string; total_hours: string }>(
        sql`SELECT 
          (SELECT COUNT(*) FROM companies)::text as companies,
          (SELECT COUNT(*) FROM business_units)::text as business_units,
          (SELECT COUNT(*) FROM processes)::text as processes,
          (SELECT COUNT(*) FROM pain_points)::text as pain_points,
          (SELECT COUNT(*) FROM use_cases)::text as use_cases,
          (SELECT COALESCE(SUM(total_hours_per_month), 0) FROM pain_points)::text as total_hours`
      );
      
      const row = stats.rows[0];
      return `DATABASE TOTALS:
- Companies: ${row.companies}
- Business Units: ${row.business_units}
- Processes: ${row.processes}
- Pain Points: ${row.pain_points}
- Solutions/Use Cases: ${row.use_cases}
- Total Hours/Month (pain points): ${parseFloat(row.total_hours).toFixed(1)}`;
    }
    
    if ((lowerQuestion.includes('per') || lowerQuestion.includes('breakdown') || lowerQuestion.includes('by')) && 
        (lowerQuestion.includes('business unit') || lowerQuestion.includes('bu'))) {
      const buBreakdown = await db.execute<{ bu_id: string; bu_name: string; company_name: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          bu.id as bu_id,
          bu.name as bu_name, 
          c.name as company_name,
          COUNT(pp.id)::text as pain_point_count,
          COALESCE(SUM(pp.total_hours_per_month), 0)::text as total_hours
        FROM business_units bu
        LEFT JOIN companies c ON bu.company_id = c.id
        LEFT JOIN pain_points pp ON pp.business_unit_id = bu.id
        GROUP BY bu.id, bu.name, c.name
        ORDER BY bu.name
        LIMIT 25`
      );
      
      if (buBreakdown.rows.length === 0) {
        return "No business units found.";
      }
      
      let result = "PAIN POINTS PER BUSINESS UNIT:\n\n";
      result += "| Business Unit | Company | Pain Points | Hours/Month |\n";
      result += "|---------------|---------|-------------|-------------|\n";
      
      buBreakdown.rows.forEach((row) => {
        const shortId = row.bu_id.substring(0, 8);
        result += `| [BU:${shortId}] ${row.bu_name} | ${row.company_name} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    if ((lowerQuestion.includes('per') || lowerQuestion.includes('breakdown') || lowerQuestion.includes('by')) && 
        lowerQuestion.includes('company')) {
      const companyBreakdown = await db.execute<{ co_id: string; co_name: string; bu_count: string; pain_point_count: string; total_hours: string }>(
        sql`SELECT 
          c.id as co_id,
          c.name as co_name,
          COUNT(DISTINCT bu.id)::text as bu_count,
          COUNT(pp.id)::text as pain_point_count,
          COALESCE(SUM(pp.total_hours_per_month), 0)::text as total_hours
        FROM companies c
        LEFT JOIN business_units bu ON bu.company_id = c.id
        LEFT JOIN pain_points pp ON pp.company_id = c.id
        GROUP BY c.id, c.name
        ORDER BY c.name
        LIMIT 25`
      );
      
      if (companyBreakdown.rows.length === 0) {
        return "No companies found.";
      }
      
      let result = "PAIN POINTS PER COMPANY:\n\n";
      result += "| Company | Business Units | Pain Points | Hours/Month |\n";
      result += "|---------|----------------|-------------|-------------|\n";
      
      companyBreakdown.rows.forEach((row) => {
        const shortId = row.co_id.substring(0, 8);
        result += `| [CO:${shortId}] ${row.co_name} | ${row.bu_count} | ${row.pain_point_count} | ${parseFloat(row.total_hours).toFixed(1)} |\n`;
      });
      
      return result;
    }
    
    console.log(`[AI] No specific query matched for: "${question.substring(0, 50)}..."`);
    return null;
  } catch (error) {
    console.error("[AI] Analytical query error:", error);
    return null;
  }
}

function isAnalyticalQuestion(question: string): boolean {
  const analyticalPatterns = [
    /which\s+(business\s+unit|bu).*(most|highest|top)/i,
    /which\s+company.*(most|highest|top)/i,
    /which\s+process.*(most|highest|top)/i,
    /which\s+category.*(most|highest|top)/i,
    /most\s+(pain\s*points?|hours|issues|problems)/i,
    /top\s+\d*\s*(business\s+units?|bus|companies|processes|solutions?|use\s+cases?)/i,
    /rank(ing)?\s+(business\s+units?|companies|processes)/i,
    /how\s+many\s+(pain\s*points?|processes|business\s+units?|companies|solutions?|use\s+cases?)/i,
    /total\s+(pain\s*points?|hours|count)/i,
    /(pain\s*points?|hours)\s+(per|by)\s+(business\s+unit|bu|company)/i,
    /breakdown\s+(by|of)\s+(business\s+unit|bu|company|category|taxonomy)/i,
    /(business\s+unit|bu|company)\s+breakdown/i,
    /pain\s*points?\s+by\s+category/i,
    /category\s+breakdown/i,
    /taxonomy\s+breakdown/i,
    /(linked|unlinked).*(pain\s*points?)/i,
    /pain\s*points?.*(linked|unlinked)/i,
    /pain\s*points?.*for\s+the\s+\w+/i,
    /pain\s*points?.*without\s+solution/i,
    /pain\s*points?.*with\s+solution/i,
    /which\s+(business\s+units?|bus|teams?|departments?).*(unlinked|linked|no solution|without solution)/i,
    /which\s+(companies|company).*(unlinked|linked|no solution|without solution)/i,
    /which\s+(processes?).*(unlinked|linked|no solution|without solution)/i,
    /(business\s+units?|bus|teams?|departments?)\s+(have|with)\s+(unlinked|linked)/i,
    /(companies|company)\s+(have|with)\s+(unlinked|linked)/i,
    /(processes?)\s+(have|with)\s+(unlinked|linked)/i,
    /not\s+(yet\s+)?linked\s+to\s+solutions?/i,
  ];
  
  return analyticalPatterns.some(pattern => pattern.test(question));
}

interface FilterContext {
  companyId?: string | null;
  companyName?: string | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  processId?: string | null;
  processName?: string | null;
}

export function invalidateDataSummaryCache() {
  cachedUnfilteredContext = null;
  unfilteredCacheTimestamp = 0;
  console.log("[AI] Data context cache invalidated");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface OpportunityResult {
  score: number;
  isEstimated: boolean;
  missingFields: string[];
}

function calculateOpportunityScore(painPoint: any, linkedSolutions: any[]): OpportunityResult {
  let score = 0;
  const missingFields: string[] = [];
  
  const hoursPerMonth = parseFloat(painPoint.totalHoursPerMonth);
  if (isNaN(hoursPerMonth)) {
    missingFields.push('hours/month');
  } else {
    if (hoursPerMonth > 100) score += 30;
    else if (hoursPerMonth > 50) score += 20;
    else if (hoursPerMonth > 20) score += 10;
  }
  
  const magnitude = parseFloat(painPoint.magnitude);
  const frequency = parseFloat(painPoint.frequency);
  if (isNaN(magnitude)) missingFields.push('magnitude');
  if (isNaN(frequency)) missingFields.push('frequency');
  if (!isNaN(magnitude) && !isNaN(frequency)) {
    score += (magnitude * frequency) / 10;
  }
  
  if (painPoint.riskLevel === 'High') score += 15;
  else if (painPoint.riskLevel === 'Medium') score += 8;
  else if (!painPoint.riskLevel) missingFields.push('risk level');
  
  const effortSolving = parseFloat(painPoint.effortSolving);
  if (isNaN(effortSolving)) {
    missingFields.push('effort to solve');
    score += 10;
  } else {
    score += (10 - effortSolving) * 2;
  }
  
  if (linkedSolutions.length > 0) {
    const avgPercentSolved = linkedSolutions.reduce((sum, l) => sum + (parseFloat(l.percentageSolved) || 0), 0) / linkedSolutions.length;
    score += avgPercentSolved / 5;
  }
  
  return {
    score: Math.min(Math.round(score), 100),
    isEstimated: missingFields.length > 0,
    missingFields
  };
}

async function getFilteredDataContext(filterContext?: FilterContext): Promise<string> {
  try {
    let resolvedCompanyId = filterContext?.companyId;
    let resolvedBusinessUnitId = filterContext?.businessUnitId;
    let resolvedProcessId = filterContext?.processId;
    
    if (!resolvedCompanyId && filterContext?.companyName) {
      const searchName = `%${filterContext.companyName.replace(/[%_]/g, '')}%`;
      const [found] = await db.select().from(companies).where(ilike(companies.name, searchName));
      if (found) resolvedCompanyId = found.id;
    }
    if (!resolvedBusinessUnitId && filterContext?.businessUnitName) {
      const searchName = `%${filterContext.businessUnitName.replace(/[%_]/g, '')}%`;
      const [found] = await db.select().from(businessUnits).where(ilike(businessUnits.name, searchName));
      if (found) resolvedBusinessUnitId = found.id;
    }
    if (!resolvedProcessId && filterContext?.processName) {
      const searchName = `%${filterContext.processName.replace(/[%_]/g, '')}%`;
      const [found] = await db.select().from(processes).where(ilike(processes.name, searchName));
      if (found) resolvedProcessId = found.id;
    }
    
    const hasActiveFilter = resolvedCompanyId || resolvedBusinessUnitId || resolvedProcessId;
    
    if (!hasActiveFilter && cachedUnfilteredContext && (Date.now() - unfilteredCacheTimestamp) < CACHE_TTL_MS) {
      console.log("[AI] Using cached unfiltered context");
      return cachedUnfilteredContext;
    }
    
    const allTaxonomy = await db.select().from(taxonomyCategories);
    const taxonomyMap = new Map(allTaxonomy.map(t => [t.id, t]));
    
    function getTaxonomyPath(l1Id?: string | null, l2Id?: string | null, l3Id?: string | null): string {
      const parts: string[] = [];
      if (l1Id && taxonomyMap.has(l1Id)) parts.push(taxonomyMap.get(l1Id)!.name);
      if (l2Id && taxonomyMap.has(l2Id)) parts.push(taxonomyMap.get(l2Id)!.name);
      if (l3Id && taxonomyMap.has(l3Id)) parts.push(taxonomyMap.get(l3Id)!.name);
      return parts.length > 0 ? parts.join(' > ') : 'Uncategorized';
    }
    
    const summary: string[] = [];
    summary.push("=== DATABASE CONTEXT ===\n");
    
    if (hasActiveFilter) {
      summary.push("** FILTERED VIEW - Showing detailed data for your current selection **\n");
      
      if (resolvedProcessId) {
        const [process] = await db.select().from(processes).where(eq(processes.id, resolvedProcessId));
        if (process) {
          const [company] = process.businessId ? await db.select().from(companies).where(eq(companies.id, process.businessId)) : [null];
          const [bu] = process.businessUnitId ? await db.select().from(businessUnits).where(eq(businessUnits.id, process.businessUnitId)) : [null];
          const procShortId = process.id.substring(0, 8);
          
          summary.push(`CURRENT PROCESS: [PROC:${procShortId}] ${process.name}`);
          summary.push(`  Company: ${company?.name || 'Unknown'}`);
          summary.push(`  Business Unit: ${bu?.name || 'N/A'}`);
          summary.push(`  Description: ${process.description || 'N/A'}`);
          summary.push(`  Volume: ${process.volume || 'N/A'} ${process.volumeUnit || ''}`);
          summary.push(`  FTE: ${process.fte || 'N/A'}`);
          summary.push(`  Owner: ${process.owner || 'N/A'}`);
          summary.push(`  Systems Used: ${process.systemsUsed || 'N/A'}`);
          
          const processPpLinks = await db.select().from(processPainPoints).where(eq(processPainPoints.processId, process.id));
          const painPointIds = processPpLinks.map(l => l.painPointId);
          
          if (painPointIds.length > 0) {
            const relatedPainPoints = await db.select().from(painPoints).where(inArray(painPoints.id, painPointIds));
            const relatedLinks = await db.select().from(painPointUseCases).where(inArray(painPointUseCases.painPointId, painPointIds));
            const useCaseIds = [...new Set(relatedLinks.map(l => l.useCaseId))];
            const relatedUseCases = useCaseIds.length > 0 ? await db.select().from(useCases).where(inArray(useCases.id, useCaseIds)) : [];
            
            const scoredPainPoints = relatedPainPoints.map(pp => {
              const ppLinks = relatedLinks.filter(l => l.painPointId === pp.id);
              const result = calculateOpportunityScore(pp, ppLinks);
              return { ...pp, ppLinks, opportunityResult: result };
            }).sort((a, b) => b.opportunityResult.score - a.opportunityResult.score);
            
            summary.push(`\nPAIN POINTS IN THIS PROCESS (${relatedPainPoints.length} total, sorted by opportunity score):`);
            for (const pp of scoredPainPoints.slice(0, 20)) {
              const linkedSolutions = pp.ppLinks.map(l => ({
                ...l,
                useCase: relatedUseCases.find(uc => uc.id === l.useCaseId)
              }));
              const { score, isEstimated, missingFields } = pp.opportunityResult;
              const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
              const shortId = pp.id.substring(0, 8);
              
              summary.push(`\n- [PP:${shortId}] "${pp.statement}"`);
              summary.push(`  Category: ${taxonomy}`);
              summary.push(`  Impact Type: ${pp.impactType?.join(', ') || 'N/A'}`);
              summary.push(`  Business Impact: ${pp.businessImpact || 'N/A'}`);
              summary.push(`  Hours/Month: ${pp.totalHoursPerMonth || 'N/A'}, FTE Impact: ${pp.fteCount || 'N/A'}`);
              summary.push(`  Root Cause: ${pp.rootCause || 'N/A'}`);
              summary.push(`  Risk Level: ${pp.riskLevel || 'N/A'}`);
              summary.push(`  OPPORTUNITY SCORE: ${score}/100${isEstimated ? ` (estimated - missing: ${missingFields.join(', ')})` : ''}`);
              
              if (linkedSolutions.length > 0) {
                summary.push(`  LINKED SOLUTIONS (${linkedSolutions.length}):`);
                for (const sol of linkedSolutions.slice(0, 5)) {
                  if (sol.useCase) {
                    const ucShortId = sol.useCase.id.substring(0, 8);
                    summary.push(`    * [UC:${ucShortId}] ${sol.useCase.name} - ${sol.percentageSolved || 0}% solved`);
                    summary.push(`      Provider: ${sol.useCase.solutionProvider || 'N/A'}, Complexity: ${sol.useCase.complexity}`);
                    if (sol.notes) summary.push(`      Notes: ${sol.notes}`);
                  }
                }
                if (linkedSolutions.length > 5) summary.push(`    ... and ${linkedSolutions.length - 5} more solutions`);
              } else {
                summary.push(`  NO LINKED SOLUTIONS - Opportunity for automation`);
              }
            }
            if (scoredPainPoints.length > 20) summary.push(`\n... and ${scoredPainPoints.length - 20} more pain points`);
          }
        }
      } else if (resolvedBusinessUnitId) {
        const [bu] = await db.select().from(businessUnits).where(eq(businessUnits.id, resolvedBusinessUnitId));
        if (bu) {
          const [company] = await db.select().from(companies).where(eq(companies.id, bu.companyId));
          const buShortId = bu.id.substring(0, 8);
          
          summary.push(`CURRENT BUSINESS UNIT: [BU:${buShortId}] ${bu.name}`);
          summary.push(`  Company: ${company?.name || 'Unknown'}`);
          summary.push(`  Description: ${bu.description || 'N/A'}`);
          summary.push(`  FTE: ${bu.fte || 0}`);
          
          const buProcesses = await db.select().from(processes).where(eq(processes.businessUnitId, bu.id));
          const buPainPoints = await db.select().from(painPoints).where(eq(painPoints.businessUnitId, bu.id));
          const buUseCases = await db.select().from(useCases).where(eq(useCases.businessUnitId, bu.id));
          
          const painPointIds = buPainPoints.map(pp => pp.id);
          const buLinks = painPointIds.length > 0 ? await db.select().from(painPointUseCases).where(inArray(painPointUseCases.painPointId, painPointIds)) : [];
          
          summary.push(`\nPROCESSES (${buProcesses.length}):`);
          for (const proc of buProcesses.slice(0, 15)) {
            const procShortId = proc.id.substring(0, 8);
            summary.push(`- [PROC:${procShortId}] ${proc.name}: ${proc.description || 'N/A'} (FTE: ${proc.fte || 'N/A'})`);
          }
          if (buProcesses.length > 15) summary.push(`... and ${buProcesses.length - 15} more`);
          
          const scoredBuPainPoints = buPainPoints.map(pp => {
            const ppLinks = buLinks.filter(l => l.painPointId === pp.id);
            const result = calculateOpportunityScore(pp, ppLinks);
            return { ...pp, ppLinks, opportunityResult: result };
          }).sort((a, b) => b.opportunityResult.score - a.opportunityResult.score);
          
          let totalHours = buPainPoints.reduce((sum, pp) => sum + (parseFloat(pp.totalHoursPerMonth as string) || 0), 0);
          let totalOpportunity = scoredBuPainPoints.reduce((sum, pp) => sum + pp.opportunityResult.score, 0);
          
          summary.push(`\nPAIN POINTS (${buPainPoints.length} total, sorted by opportunity score):`);
          for (const pp of scoredBuPainPoints.slice(0, 25)) {
            const { score, isEstimated, missingFields } = pp.opportunityResult;
            const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
            const shortId = pp.id.substring(0, 8);
            
            summary.push(`- [PP:${shortId}] "${pp.statement?.substring(0, 80)}${pp.statement && pp.statement.length > 80 ? '...' : ''}"`);
            summary.push(`  Category: ${taxonomy} | Hours/Month: ${pp.totalHoursPerMonth || 'N/A'} | Opportunity: ${score}/100${isEstimated ? ' (est)' : ''}`);
            summary.push(`  Solutions Linked: ${pp.ppLinks.length}`);
          }
          if (scoredBuPainPoints.length > 25) summary.push(`... and ${scoredBuPainPoints.length - 25} more`);
          
          summary.push(`\nBUSINESS UNIT METRICS:`);
          summary.push(`  Total Pain Point Hours/Month: ${totalHours.toFixed(1)}`);
          summary.push(`  Average Opportunity Score: ${buPainPoints.length > 0 ? (totalOpportunity / buPainPoints.length).toFixed(0) : 0}/100`);
          summary.push(`  Solutions Available: ${buUseCases.length}`);
        }
      } else if (resolvedCompanyId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, resolvedCompanyId));
        if (company) {
          const compShortId = company.id.substring(0, 8);
          summary.push(`CURRENT COMPANY: [CO:${compShortId}] ${company.name}`);
          summary.push(`  Industry: ${company.industry || 'N/A'}`);
          summary.push(`  ANZSIC: ${company.anzsic || 'N/A'}`);
          
          const companyBUs = await db.select().from(businessUnits).where(eq(businessUnits.companyId, company.id));
          const companyProcesses = await db.select().from(processes).where(eq(processes.businessId, company.id));
          const companyPainPoints = await db.select().from(painPoints).where(eq(painPoints.companyId, company.id));
          const companyUseCases = await db.select().from(useCases).where(eq(useCases.companyId, company.id));
          
          const painPointIds = companyPainPoints.map(pp => pp.id);
          const companyLinks = painPointIds.length > 0 ? await db.select().from(painPointUseCases).where(inArray(painPointUseCases.painPointId, painPointIds)) : [];
          
          const totalFTE = companyBUs.reduce((sum, bu) => sum + (bu.fte || 0), 0);
          
          summary.push(`\nCOMPANY OVERVIEW:`);
          summary.push(`  Business Units: ${companyBUs.length} (Total FTE: ${totalFTE})`);
          summary.push(`  Processes: ${companyProcesses.length}`);
          summary.push(`  Pain Points: ${companyPainPoints.length}`);
          summary.push(`  Solutions/Use Cases: ${companyUseCases.length}`);
          
          summary.push(`\nBUSINESS UNITS:`);
          for (const bu of companyBUs.slice(0, 15)) {
            const buPainPointsList = companyPainPoints.filter(pp => pp.businessUnitId === bu.id);
            const buShortId = bu.id.substring(0, 8);
            summary.push(`- [BU:${buShortId}] ${bu.name} (FTE: ${bu.fte || 0}, Pain Points: ${buPainPointsList.length})`);
          }
          if (companyBUs.length > 15) summary.push(`... and ${companyBUs.length - 15} more`);
          
          summary.push(`\nTOP PAIN POINTS BY OPPORTUNITY:`);
          const painPointsWithScores = companyPainPoints.map(pp => {
            const ppLinks = companyLinks.filter(l => l.painPointId === pp.id);
            const result = calculateOpportunityScore(pp, ppLinks);
            return { ...pp, opportunityResult: result, linkedCount: ppLinks.length };
          }).sort((a, b) => b.opportunityResult.score - a.opportunityResult.score);
          
          for (const pp of painPointsWithScores.slice(0, 15)) {
            const { score, isEstimated } = pp.opportunityResult;
            const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
            const buName = companyBUs.find(bu => bu.id === pp.businessUnitId)?.name || 'N/A';
            const shortId = pp.id.substring(0, 8);
            summary.push(`- [PP:${shortId}] [Score: ${score}${isEstimated ? ' est' : ''}] "${pp.statement?.substring(0, 60)}..."`);
            summary.push(`  BU: ${buName} | Category: ${taxonomy} | Solutions: ${pp.linkedCount}`);
          }
          if (painPointsWithScores.length > 15) summary.push(`... and ${painPointsWithScores.length - 15} more`);
          
          const taxonomyCounts = new Map<string, number>();
          for (const pp of companyPainPoints) {
            const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
            taxonomyCounts.set(taxonomy, (taxonomyCounts.get(taxonomy) || 0) + 1);
          }
          
          summary.push(`\nPAIN POINTS BY CATEGORY:`);
          const sortedTaxonomy = Array.from(taxonomyCounts.entries()).sort((a, b) => b[1] - a[1]);
          for (const [cat, count] of sortedTaxonomy.slice(0, 10)) {
            summary.push(`- ${cat}: ${count} pain points`);
          }
        }
      }
    } else {
      summary.push("** FULL DATABASE OVERVIEW **\n");
      
      const allCompanies = await db.select().from(companies);
      const allBusinessUnits = await db.select().from(businessUnits);
      const allProcesses = await db.select().from(processes);
      const allPainPoints = await db.select().from(painPoints);
      const allUseCases = await db.select().from(useCases);
      const allLinks = await db.select().from(painPointUseCases);
      
      summary.push(`DATABASE STATISTICS:`);
      summary.push(`  Companies: ${allCompanies.length}`);
      summary.push(`  Business Units: ${allBusinessUnits.length}`);
      summary.push(`  Processes: ${allProcesses.length}`);
      summary.push(`  Pain Points: ${allPainPoints.length}`);
      summary.push(`  Solutions/Use Cases: ${allUseCases.length}`);
      
      const totalHours = allPainPoints.reduce((sum, pp) => sum + (parseFloat(pp.totalHoursPerMonth as string) || 0), 0);
      const painPointsWithSolutions = allPainPoints.filter(pp => allLinks.some(l => l.painPointId === pp.id)).length;
      
      summary.push(`\nKEY METRICS:`);
      summary.push(`  Total Pain Point Hours/Month: ${totalHours.toFixed(1)}`);
      summary.push(`  Pain Points with Solutions: ${painPointsWithSolutions} (${allPainPoints.length > 0 ? ((painPointsWithSolutions / allPainPoints.length) * 100).toFixed(0) : 0}%)`);
      summary.push(`  Unaddressed Pain Points: ${allPainPoints.length - painPointsWithSolutions}`);
      
      summary.push(`\nCOMPANIES:`);
      for (const company of allCompanies.slice(0, 15)) {
        const companyBUs = allBusinessUnits.filter(bu => bu.companyId === company.id);
        const companyPPs = allPainPoints.filter(pp => pp.companyId === company.id);
        const compShortId = company.id.substring(0, 8);
        summary.push(`- [CO:${compShortId}] ${company.name} (Industry: ${company.industry || 'N/A'})`);
        summary.push(`  BUs: ${companyBUs.length}, Pain Points: ${companyPPs.length}`);
      }
      
      summary.push(`\nTOP PAIN POINTS BY OPPORTUNITY:`);
      const scoredPainPoints = allPainPoints.map(pp => {
        const ppLinks = allLinks.filter(l => l.painPointId === pp.id);
        const result = calculateOpportunityScore(pp, ppLinks);
        return { ...pp, opportunityResult: result, company: allCompanies.find(c => c.id === pp.companyId)?.name };
      }).sort((a, b) => b.opportunityResult.score - a.opportunityResult.score);
      
      for (const pp of scoredPainPoints.slice(0, 20)) {
        const { score, isEstimated } = pp.opportunityResult;
        const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
        const shortId = pp.id.substring(0, 8);
        summary.push(`- [PP:${shortId}] [Score: ${score}${isEstimated ? ' est' : ''}] "${pp.statement?.substring(0, 50)}..."`);
        summary.push(`  Company: ${pp.company || 'Unknown'} | Category: ${taxonomy}`);
      }
      
      const taxonomyCounts = new Map<string, number>();
      for (const pp of allPainPoints) {
        const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
        taxonomyCounts.set(taxonomy, (taxonomyCounts.get(taxonomy) || 0) + 1);
      }
      
      summary.push(`\nPAIN POINTS BY CATEGORY:`);
      const sortedTaxonomy = Array.from(taxonomyCounts.entries()).sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of sortedTaxonomy.slice(0, 15)) {
        summary.push(`- ${cat}: ${count} pain points`);
      }
      
      summary.push(`\nAVAILABLE SOLUTIONS:`);
      for (const uc of allUseCases.slice(0, 15)) {
        const linkedCount = allLinks.filter(l => l.useCaseId === uc.id).length;
        const ucShortId = uc.id.substring(0, 8);
        summary.push(`- [UC:${ucShortId}] ${uc.name} (Provider: ${uc.solutionProvider || 'N/A'}, Complexity: ${uc.complexity})`);
        summary.push(`  Linked to ${linkedCount} pain points`);
      }
    }
    
    summary.push("\n=== END DATABASE CONTEXT ===");
    
    let result = summary.join('\n');
    if (result.length > MAX_CONTEXT_CHARS) {
      result = result.substring(0, MAX_CONTEXT_CHARS) + "\n... [context truncated for length]";
    }
    
    if (!hasActiveFilter) {
      cachedUnfilteredContext = result;
      unfilteredCacheTimestamp = Date.now();
      console.log(`[AI] Unfiltered context cached: ${result.length} chars, ~${estimateTokens(result)} tokens`);
    } else {
      console.log(`[AI] Filtered context generated: ${result.length} chars, ~${estimateTokens(result)} tokens`);
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching data context:", error);
    return "Unable to fetch database context.";
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { messages, config } = req.body as {
      messages: ChatMessage[];
      config?: AIConfig;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    const limitedMessages = messages.length > MAX_HISTORY_MESSAGES
      ? messages.slice(-MAX_HISTORY_MESSAGES)
      : messages;

    const filterContext: FilterContext | undefined = config?.filterContext ? {
      companyId: config.filterContext.companyId,
      companyName: config.filterContext.companyName,
      businessUnitId: config.filterContext.businessUnitId,
      businessUnitName: config.filterContext.businessUnitName,
      processId: config.filterContext.processId,
      processName: config.filterContext.processName,
    } : undefined;
    
    const lastUserMessage = limitedMessages.filter(m => m.role === 'user').pop()?.content || '';
    let analyticalResults: string | null = null;
    
    if (isAnalyticalQuestion(lastUserMessage)) {
      console.log(`[AI] Detected analytical question, executing query...`);
      analyticalResults = await executeAnalyticalQuery(lastUserMessage);
      if (analyticalResults) {
        console.log(`[AI] Analytical query returned ${analyticalResults.length} chars`);
      }
    }
    
    const dataContext = await getFilteredDataContext(filterContext);
    
    let fullContext = DATABASE_SCHEMA_DESCRIPTION + "\n" + dataContext;
    
    if (analyticalResults) {
      fullContext += "\n\n=== QUERY RESULTS FOR YOUR QUESTION ===\n" + analyticalResults + "\n=== END QUERY RESULTS ===\n\nUse the above query results to answer the user's question. The data is accurate and up-to-date from the database.";
    }
    
    const messagesText = limitedMessages.map(m => m.content).join(' ');
    const systemPromptEstimate = 500;
    const totalTokenEstimate = estimateTokens(fullContext) + estimateTokens(messagesText) + systemPromptEstimate;
    console.log(`[AI] Streaming request: ${limitedMessages.length} messages, ~${totalTokenEstimate} tokens total`);
    
    if (totalTokenEstimate > 15000) {
      console.warn(`[AI] Warning: Token estimate ${totalTokenEstimate} approaching limit`);
    }
    
    const enrichedConfig: AIConfig = {
      ...config,
      dataContext: fullContext,
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'none');
    res.flushHeaders();

    const stream = generateChatResponseStream(limitedMessages, enrichedConfig);
    
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("AI chat error:", error);
    
    let errorMessage = "Failed to generate AI response";
    
    if (error?.status === 429) {
      errorMessage = "Too many requests. Please wait a moment and try again.";
    } else if (error?.code === "context_length_exceeded" || error?.message?.includes("context") || error?.message?.includes("token")) {
      errorMessage = "The conversation is too long. Please start a new conversation.";
    } else if (error?.status === 401 || error?.status === 403) {
      errorMessage = "AI service authentication error. Please contact support.";
    } else if (error?.message) {
      errorMessage = `AI error: ${error.message.substring(0, 100)}`;
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
});

router.get("/status", (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const hasBaseUrl = !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  res.json({
    configured: hasApiKey && hasBaseUrl,
    ready: hasApiKey && hasBaseUrl,
  });
});

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { search } = req.query;
    
    let conversations;
    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conversations = await db.select({
        id: aiConversations.id,
        title: aiConversations.title,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt
      })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.userId, user.id),
          ilike(aiConversations.title, searchTerm)
        )
      )
      .orderBy(desc(aiConversations.updatedAt));
    } else {
      conversations = await db.select({
        id: aiConversations.id,
        title: aiConversations.title,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt
      })
      .from(aiConversations)
      .where(eq(aiConversations.userId, user.id))
      .orderBy(desc(aiConversations.updatedAt));
    }

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { title } = req.body;

    const [conversation] = await db.insert(aiConversations).values({
      userId: user.id,
      title: title || "New Conversation"
    }).returning();

    res.json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;

    const [conversation] = await db.select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, user.id)
      ));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db.select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(aiMessages.createdAt);

    res.json({
      ...conversation,
      messages
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.put("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;
    const { title } = req.body;

    const [existing] = await db.select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const [updated] = await db.update(aiConversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(aiConversations.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;

    const [existing] = await db.select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await db.delete(aiConversations).where(eq(aiConversations.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;
    const { role, content, attachments } = req.body;

    const [existing] = await db.select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const [message] = await db.insert(aiMessages).values({
      conversationId: id,
      role,
      content,
      attachments: attachments || null
    }).returning();

    await db.update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, id));

    res.json(message);
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

// Admin endpoint: Get all conversations across all users
router.get("/admin/conversations", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const allConversations = await db
      .select({
        id: aiConversations.id,
        userId: aiConversations.userId,
        title: aiConversations.title,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(aiConversations)
      .leftJoin(users, eq(aiConversations.userId, users.id))
      .orderBy(desc(aiConversations.updatedAt));

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      allConversations.map(async (conv) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, conv.id));
        
        return {
          ...conv,
          messageCount: countResult?.count || 0,
          userName: conv.userFirstName && conv.userLastName 
            ? `${conv.userFirstName} ${conv.userLastName}` 
            : conv.userEmail || 'Unknown User'
        };
      })
    );

    res.json(conversationsWithCounts);
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Admin endpoint: Delete multiple conversations
router.delete("/admin/conversations", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No conversation IDs provided" });
    }

    await db.delete(aiConversations).where(inArray(aiConversations.id, ids));

    res.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    console.error("Error deleting conversations:", error);
    res.status(500).json({ error: "Failed to delete conversations" });
  }
});

// Admin endpoint: Delete all conversations
router.delete("/admin/conversations/all", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const result = await db.delete(aiConversations);
    
    res.json({ success: true, message: "All conversations deleted" });
  } catch (error) {
    console.error("Error deleting all conversations:", error);
    res.status(500).json({ error: "Failed to delete all conversations" });
  }
});

router.post("/execute-sql", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(`[AI SQL] User ${user.email} executing query: ${query.substring(0, 100)}...`);
    
    const result = await executeReadOnlySQL(query, user.id);
    
    if (result.success) {
      console.log(`[AI SQL] Query successful: ${result.rowCount} rows in ${result.executionTimeMs}ms`);
    } else {
      console.log(`[AI SQL] Query failed: ${result.error}`);
    }

    res.json(result);
  } catch (error) {
    console.error("SQL execution error:", error);
    res.status(500).json({ error: "Failed to execute query" });
  }
});

router.get("/admin/sql-audit-logs", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const logs = getAuditLogs(limit);
    
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
