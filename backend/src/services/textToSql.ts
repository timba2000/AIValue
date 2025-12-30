import OpenAI from "openai";
import { executeReadOnlySQL, formatResultsAsMarkdown, SQLExecutionResult } from "./sqlExecutor.js";

const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "";
const openai = new OpenAI({
  baseURL: baseUrl.endsWith("/openai") ? baseUrl : baseUrl,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const COMPREHENSIVE_SCHEMA = `
You are a SQL query generator for a business process intelligence database. Generate PostgreSQL SELECT queries to answer user questions about the data.

=== DATABASE SCHEMA ===

TABLE: companies
  - id (uuid, primary key)
  - name (text) - Company name
  - industry (text) - Industry sector
  - anzsic (text) - ANZSIC code
  - created_at, updated_at (timestamp)

TABLE: business_units  
  - id (uuid, primary key)
  - company_id (uuid, FK -> companies.id)
  - parent_id (uuid, nullable, self-reference for hierarchy)
  - name (text) - Business unit name
  - description (text)
  - fte (integer) - Full-time equivalent headcount
  - created_at, updated_at (timestamp)

TABLE: processes
  - id (uuid, primary key)
  - business_id (uuid, FK -> companies.id) - The company this process belongs to
  - business_unit_id (uuid, FK -> business_units.id, nullable)
  - name (text) - Process name
  - description (text)
  - volume (numeric), volume_unit (text)
  - fte (numeric)
  - owner (text)
  - systems_used (text)
  - created_at, updated_at (timestamp)

TABLE: pain_points
  - id (uuid, primary key)
  - statement (text) - Description of the pain point/problem
  - impact_type (text[]) - Array of impact types
  - business_impact (text)
  - magnitude (numeric, 1-10 scale)
  - frequency (numeric, 1-10 scale)
  - time_per_unit (numeric)
  - total_hours_per_month (numeric) - Key metric for impact
  - fte_count (numeric)
  - root_cause (text)
  - workarounds (text)
  - dependencies (text)
  - risk_level (text) - 'High', 'Medium', 'Low'
  - effort_solving (numeric, 1-10 scale)
  - taxonomy_level1_id, taxonomy_level2_id, taxonomy_level3_id (uuid, FK -> taxonomy_categories.id)
  - company_id (uuid, FK -> companies.id)
  - business_unit_id (uuid, FK -> business_units.id)
  - created_at, updated_at (timestamp)

TABLE: use_cases (also called "solutions")
  - id (uuid, primary key)
  - name (text) - Solution/use case name
  - solution_provider (text) - Vendor or provider name (e.g., "Adobe", "Microsoft", "UiPath")
  - problem_to_solve (text)
  - solution_overview (text)
  - complexity (text) - 'Low', 'Medium', 'High'
  - data_requirements (text[])
  - systems_impacted (text)
  - risks (text)
  - estimated_delivery_time (text)
  - cost_range (text)
  - confidence_level (text)
  - process_id (uuid, FK -> processes.id)
  - company_id (uuid, FK -> companies.id)
  - business_unit_id (uuid, FK -> business_units.id)
  - created_at, updated_at (timestamp)

TABLE: pain_point_use_cases (junction table linking pain points to solutions)
  - id (uuid, primary key)
  - pain_point_id (uuid, FK -> pain_points.id)
  - use_case_id (uuid, FK -> use_cases.id)
  - percentage_solved (numeric) - How much of the pain point this solution addresses
  - notes (text)
  - created_at, updated_at (timestamp)

TABLE: process_pain_points (junction table linking processes to pain points)
  - id (uuid, primary key)
  - process_id (uuid, FK -> processes.id)
  - pain_point_id (uuid, FK -> pain_points.id)

TABLE: taxonomy_categories (hierarchical categorization)
  - id (uuid, primary key)
  - name (text)
  - parent_id (uuid, nullable)
  - level (integer) - 1, 2, or 3

=== KEY CONCEPTS ===

LINKED vs UNLINKED PAIN POINTS:
- A pain point is "LINKED" if it has at least one entry in pain_point_use_cases table
- A pain point is "UNLINKED" if it has NO entries in pain_point_use_cases table
- To check if linked: EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id)
- To check if unlinked: NOT EXISTS (SELECT 1 FROM pain_point_use_cases ppuc WHERE ppuc.pain_point_id = pp.id)

SOLUTIONS / USE CASES:
- "use_cases" table stores solutions - users may refer to them as "solutions", "use cases", or by provider name
- To find pain points linked to a specific solution (e.g., "Adobe"): 
  JOIN pain_point_use_cases ON pain point, then JOIN use_cases and filter by name or solution_provider

HIERARCHY:
- Companies contain Business Units (can be nested via parent_id)
- Business Units contain Processes
- Processes and Business Units have Pain Points
- Pain Points can be linked to Solutions (Use Cases)

=== RULES ===

1. Only generate SELECT or WITH...SELECT queries
2. Always include LIMIT (default 50 for lists, 100 max)
3. Use table aliases for readability (pp for pain_points, uc for use_cases, bu for business_units, c for companies, ppuc for pain_point_use_cases)
4. For text searches, use ILIKE with % wildcards for case-insensitive matching
5. Include relevant columns that answer the question
6. Format numbers appropriately (use COALESCE for nulls, ::text for display)
7. Order results meaningfully (by hours DESC, by count DESC, alphabetically, etc.)
8. Use LEFT JOINs when you need to include entities even if they have no related records

=== OUTPUT FORMAT ===

Return ONLY the SQL query, nothing else. No explanation, no markdown code blocks, just the raw SQL.
If you cannot generate a valid query for the question, return: CANNOT_GENERATE
`;

export interface TextToSqlResult {
  success: boolean;
  query?: string;
  results?: SQLExecutionResult;
  formattedResults?: string;
  error?: string;
}

export async function generateAndExecuteQuery(
  userQuestion: string,
  userId?: string
): Promise<TextToSqlResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: COMPREHENSIVE_SCHEMA
        },
        {
          role: "user", 
          content: `Generate a PostgreSQL query to answer this question: "${userQuestion}"`
        }
      ],
      temperature: 0,
      max_tokens: 1000
    });

    const generatedQuery = response.choices[0]?.message?.content?.trim();

    if (!generatedQuery || generatedQuery === "CANNOT_GENERATE") {
      return {
        success: false,
        error: "I couldn't generate a query for that question. Could you rephrase it or be more specific about what data you're looking for?"
      };
    }

    const cleanQuery = generatedQuery
      .replace(/^```sql\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    console.log(`[TextToSQL] Generated query for "${userQuestion.substring(0, 50)}...":\n${cleanQuery}`);

    const result = await executeReadOnlySQL(cleanQuery, userId);

    if (!result.success) {
      console.error(`[TextToSQL] Query execution failed: ${result.error}`);
      const retryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [
          {
            role: "system",
            content: COMPREHENSIVE_SCHEMA + `\n\nPREVIOUS QUERY FAILED WITH ERROR: ${result.error}\nPlease fix the query.`
          },
          {
            role: "user",
            content: `Generate a PostgreSQL query to answer this question: "${userQuestion}"`
          }
        ],
        temperature: 0,
        max_tokens: 1000
      });

      const retryQuery = retryResponse.choices[0]?.message?.content?.trim();
      if (retryQuery && retryQuery !== "CANNOT_GENERATE") {
        const cleanRetryQuery = retryQuery
          .replace(/^```sql\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        
        console.log(`[TextToSQL] Retry query:\n${cleanRetryQuery}`);
        const retryResult = await executeReadOnlySQL(cleanRetryQuery, userId);
        
        if (retryResult.success) {
          return {
            success: true,
            query: cleanRetryQuery,
            results: retryResult,
            formattedResults: formatResultsAsMarkdown(retryResult)
          };
        }
      }

      return {
        success: false,
        query: cleanQuery,
        error: `Query error: ${result.error}. Please try rephrasing your question.`
      };
    }

    return {
      success: true,
      query: cleanQuery,
      results: result,
      formattedResults: formatResultsAsMarkdown(result)
    };

  } catch (error: any) {
    console.error("[TextToSQL] Error:", error);
    return {
      success: false,
      error: `Failed to process query: ${error.message}`
    };
  }
}

export function isDataQuestion(question: string): boolean {
  const lowerQ = question.toLowerCase();
  
  const domainEntities = [
    'pain point', 'pain points', 'painpoint', 'painpoints',
    'solution', 'solutions', 'use case', 'use cases',
    'business unit', 'business units',
    'company', 'companies',
    'process', 'processes',
  ];
  
  const analyticalPatterns = [
    /which\s+.*(pain\s*point|solution|business\s+unit|company|process)/i,
    /list\s+.*(pain\s*point|solution|business\s+unit|company|process)/i,
    /show\s+.*(pain\s*point|solution|business\s+unit|company|process)/i,
    /find\s+.*(pain\s*point|solution|business\s+unit|company|process)/i,
    /how\s+many\s+(pain\s*point|solution|business\s+unit|company|process)/i,
    /(linked|unlinked|not\s+linked).*(pain\s*point|solution)/i,
    /(pain\s*point|solution).*(linked|unlinked|not\s+linked)/i,
    /top\s+\d*\s*(pain\s*point|solution|business\s+unit|company|process)/i,
    /(most|least|highest|lowest).*(pain\s*point|solution|hours|business\s+unit)/i,
    /breakdown\s+(by|of|per)/i,
    /(pain\s*point|solution|hours).*(per|by)\s+(business\s+unit|company|process)/i,
    /total\s+(pain\s*point|solution|hours)/i,
    /count\s+(of\s+)?(pain\s*point|solution|business\s+unit)/i,
    /what\s+(are|is)\s+the\s+(pain\s*point|solution|business\s+unit|company|process)/i,
    /(adobe|microsoft|uipath|automation\s*anywhere).*(solution|linked|pain\s*point)/i,
    /(solution|linked|pain\s*point).*(adobe|microsoft|uipath|automation\s*anywhere)/i,
    /rank(ing)?\s+(pain\s*point|solution|business\s+unit|company|process)/i,
    /compare\s+.*(pain\s*point|solution|business\s+unit|company|process)/i,
    /average\s+(hours|magnitude|frequency|fte)/i,
    /hours\s+per\s+month/i,
  ];
  
  const hasPatternMatch = analyticalPatterns.some(pattern => pattern.test(lowerQ));
  if (hasPatternMatch) {
    return true;
  }
  
  const entityMatchCount = domainEntities.filter(entity => lowerQ.includes(entity)).length;
  const actionWords = ['list', 'show', 'find', 'get', 'display', 'count', 'total', 'how many', 'which', 'what are'];
  const hasActionWord = actionWords.some(word => lowerQ.includes(word));
  
  return entityMatchCount >= 1 && hasActionWord;
}
