import { Router, Request, Response } from "express";
import { generateChatResponse, generateChatResponseStream, ChatMessage, AIConfig } from "../services/aiService.js";
import { db } from "../db/client.js";
import { companies, businessUnits, processes, painPoints, useCases, painPointUseCases, aiConversations, aiMessages, taxonomyCategories, processPainPoints } from "../db/schema.js";
import { eq, desc, ilike, or, and, inArray } from "drizzle-orm";
import { getUser } from "../simpleAuth.js";

const router = Router();

const MAX_CONTEXT_CHARS = 40000;
const MAX_HISTORY_MESSAGES = 10;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedUnfilteredContext: string | null = null;
let unfilteredCacheTimestamp: number = 0;

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

function calculateOpportunityScore(painPoint: any, linkedSolutions: any[]): number {
  let score = 0;
  
  const hoursPerMonth = parseFloat(painPoint.totalHoursPerMonth) || 0;
  if (hoursPerMonth > 100) score += 30;
  else if (hoursPerMonth > 50) score += 20;
  else if (hoursPerMonth > 20) score += 10;
  
  const magnitude = parseFloat(painPoint.magnitude) || 0;
  const frequency = parseFloat(painPoint.frequency) || 0;
  score += (magnitude * frequency) / 10;
  
  if (painPoint.riskLevel === 'High') score += 15;
  else if (painPoint.riskLevel === 'Medium') score += 8;
  
  const effortSolving = parseFloat(painPoint.effortSolving) || 5;
  score += (10 - effortSolving) * 2;
  
  if (linkedSolutions.length > 0) {
    const avgPercentSolved = linkedSolutions.reduce((sum, l) => sum + (parseFloat(l.percentageSolved) || 0), 0) / linkedSolutions.length;
    score += avgPercentSolved / 5;
  }
  
  return Math.min(Math.round(score), 100);
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
          
          summary.push(`CURRENT PROCESS: ${process.name}`);
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
            
            summary.push(`\nPAIN POINTS IN THIS PROCESS (${relatedPainPoints.length} total):`);
            for (const pp of relatedPainPoints.slice(0, 20)) {
              const ppLinks = relatedLinks.filter(l => l.painPointId === pp.id);
              const linkedSolutions = ppLinks.map(l => ({
                ...l,
                useCase: relatedUseCases.find(uc => uc.id === l.useCaseId)
              }));
              const opportunityScore = calculateOpportunityScore(pp, ppLinks);
              const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
              
              summary.push(`\n- "${pp.statement}"`);
              summary.push(`  Category: ${taxonomy}`);
              summary.push(`  Impact Type: ${pp.impactType?.join(', ') || 'N/A'}`);
              summary.push(`  Business Impact: ${pp.businessImpact || 'N/A'}`);
              summary.push(`  Hours/Month: ${pp.totalHoursPerMonth || 'N/A'}, FTE Impact: ${pp.fteCount || 'N/A'}`);
              summary.push(`  Root Cause: ${pp.rootCause || 'N/A'}`);
              summary.push(`  Risk Level: ${pp.riskLevel || 'N/A'}`);
              summary.push(`  OPPORTUNITY SCORE: ${opportunityScore}/100`);
              
              if (linkedSolutions.length > 0) {
                summary.push(`  LINKED SOLUTIONS (${linkedSolutions.length}):`);
                for (const sol of linkedSolutions.slice(0, 5)) {
                  if (sol.useCase) {
                    summary.push(`    * ${sol.useCase.name} - ${sol.percentageSolved || 0}% solved`);
                    summary.push(`      Provider: ${sol.useCase.solutionProvider || 'N/A'}, Complexity: ${sol.useCase.complexity}`);
                    if (sol.notes) summary.push(`      Notes: ${sol.notes}`);
                  }
                }
                if (linkedSolutions.length > 5) summary.push(`    ... and ${linkedSolutions.length - 5} more solutions`);
              } else {
                summary.push(`  NO LINKED SOLUTIONS - Opportunity for automation`);
              }
            }
            if (relatedPainPoints.length > 20) summary.push(`\n... and ${relatedPainPoints.length - 20} more pain points`);
          }
        }
      } else if (resolvedBusinessUnitId) {
        const [bu] = await db.select().from(businessUnits).where(eq(businessUnits.id, resolvedBusinessUnitId));
        if (bu) {
          const [company] = await db.select().from(companies).where(eq(companies.id, bu.companyId));
          
          summary.push(`CURRENT BUSINESS UNIT: ${bu.name}`);
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
            summary.push(`- ${proc.name}: ${proc.description || 'N/A'} (FTE: ${proc.fte || 'N/A'})`);
          }
          if (buProcesses.length > 15) summary.push(`... and ${buProcesses.length - 15} more`);
          
          summary.push(`\nPAIN POINTS (${buPainPoints.length}):`);
          let totalHours = 0;
          let totalOpportunity = 0;
          for (const pp of buPainPoints.slice(0, 25)) {
            const ppLinks = buLinks.filter(l => l.painPointId === pp.id);
            const opportunityScore = calculateOpportunityScore(pp, ppLinks);
            totalOpportunity += opportunityScore;
            totalHours += parseFloat(pp.totalHoursPerMonth as string) || 0;
            const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
            
            summary.push(`- "${pp.statement?.substring(0, 80)}${pp.statement && pp.statement.length > 80 ? '...' : ''}"`);
            summary.push(`  Category: ${taxonomy} | Hours/Month: ${pp.totalHoursPerMonth || 'N/A'} | Opportunity: ${opportunityScore}/100`);
            summary.push(`  Solutions Linked: ${ppLinks.length}`);
          }
          if (buPainPoints.length > 25) summary.push(`... and ${buPainPoints.length - 25} more`);
          
          summary.push(`\nBUSINESS UNIT METRICS:`);
          summary.push(`  Total Pain Point Hours/Month: ${totalHours.toFixed(1)}`);
          summary.push(`  Average Opportunity Score: ${buPainPoints.length > 0 ? (totalOpportunity / buPainPoints.length).toFixed(0) : 0}/100`);
          summary.push(`  Solutions Available: ${buUseCases.length}`);
        }
      } else if (resolvedCompanyId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, resolvedCompanyId));
        if (company) {
          summary.push(`CURRENT COMPANY: ${company.name}`);
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
            const buPainPoints = companyPainPoints.filter(pp => pp.businessUnitId === bu.id);
            summary.push(`- ${bu.name} (FTE: ${bu.fte || 0}, Pain Points: ${buPainPoints.length})`);
          }
          if (companyBUs.length > 15) summary.push(`... and ${companyBUs.length - 15} more`);
          
          summary.push(`\nTOP PAIN POINTS BY OPPORTUNITY:`);
          const painPointsWithScores = companyPainPoints.map(pp => {
            const ppLinks = companyLinks.filter(l => l.painPointId === pp.id);
            return { ...pp, score: calculateOpportunityScore(pp, ppLinks), linkedCount: ppLinks.length };
          }).sort((a, b) => b.score - a.score);
          
          for (const pp of painPointsWithScores.slice(0, 15)) {
            const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
            const buName = companyBUs.find(bu => bu.id === pp.businessUnitId)?.name || 'N/A';
            summary.push(`- [Score: ${pp.score}] "${pp.statement?.substring(0, 60)}..."`);
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
        summary.push(`- ${company.name} (Industry: ${company.industry || 'N/A'})`);
        summary.push(`  BUs: ${companyBUs.length}, Pain Points: ${companyPPs.length}`);
      }
      
      summary.push(`\nTOP PAIN POINTS BY OPPORTUNITY:`);
      const scoredPainPoints = allPainPoints.map(pp => {
        const ppLinks = allLinks.filter(l => l.painPointId === pp.id);
        return { ...pp, score: calculateOpportunityScore(pp, ppLinks), company: allCompanies.find(c => c.id === pp.companyId)?.name };
      }).sort((a, b) => b.score - a.score);
      
      for (const pp of scoredPainPoints.slice(0, 20)) {
        const taxonomy = getTaxonomyPath(pp.taxonomyLevel1Id, pp.taxonomyLevel2Id, pp.taxonomyLevel3Id);
        summary.push(`- [Score: ${pp.score}] "${pp.statement?.substring(0, 50)}..."`);
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
        summary.push(`- ${uc.name} (Provider: ${uc.solutionProvider || 'N/A'}, Complexity: ${uc.complexity})`);
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
    
    const dataContext = await getFilteredDataContext(filterContext);
    
    const messagesText = limitedMessages.map(m => m.content).join(' ');
    const systemPromptEstimate = 500;
    const totalTokenEstimate = estimateTokens(dataContext) + estimateTokens(messagesText) + systemPromptEstimate;
    console.log(`[AI] Streaming request: ${limitedMessages.length} messages, ~${totalTokenEstimate} tokens total`);
    
    if (totalTokenEstimate > 15000) {
      console.warn(`[AI] Warning: Token estimate ${totalTokenEstimate} approaching limit`);
    }
    
    const enrichedConfig: AIConfig = {
      ...config,
      dataContext: dataContext,
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

export default router;
