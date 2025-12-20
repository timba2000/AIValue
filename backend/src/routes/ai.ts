import { Router, Request, Response } from "express";
import { generateChatResponse, generateChatResponseStream, ChatMessage, AIConfig } from "../services/aiService.js";
import { db } from "../db/client.js";
import { companies, businessUnits, processes, painPoints, useCases, painPointUseCases, aiConversations, aiMessages } from "../db/schema.js";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { getUser } from "../simpleAuth.js";

const router = Router();

const MAX_CONTEXT_CHARS = 30000;
const MAX_HISTORY_MESSAGES = 10;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedDataSummary: string | null = null;
let cacheTimestamp: number = 0;

export function invalidateDataSummaryCache() {
  cachedDataSummary = null;
  cacheTimestamp = 0;
  console.log("[AI] Data summary cache invalidated");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function getDataSummary(): Promise<string> {
  if (cachedDataSummary && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedDataSummary;
  }
  try {
    const allCompanies = await db.select().from(companies);
    const allBusinessUnits = await db.select().from(businessUnits);
    const allProcesses = await db.select().from(processes);
    const allPainPoints = await db.select().from(painPoints);
    const allUseCases = await db.select().from(useCases);
    const allLinks = await db.select().from(painPointUseCases);

    const summary: string[] = [];
    
    summary.push("=== DATABASE CONTEXT ===\n");
    
    summary.push(`COMPANIES (${allCompanies.length} total):`);
    for (const company of allCompanies.slice(0, 20)) {
      const companyBUs = allBusinessUnits.filter(bu => bu.companyId === company.id);
      const companyProcesses = allProcesses.filter(p => p.businessId === company.id);
      const companyPainPoints = allPainPoints.filter(pp => pp.companyId === company.id);
      summary.push(`- ${company.name} (Industry: ${company.industry || 'N/A'})`);
      summary.push(`  Business Units: ${companyBUs.length}, Processes: ${companyProcesses.length}, Pain Points: ${companyPainPoints.length}`);
    }
    if (allCompanies.length > 20) summary.push(`  ... and ${allCompanies.length - 20} more companies`);
    
    summary.push(`\nBUSINESS UNITS (${allBusinessUnits.length} total):`);
    for (const bu of allBusinessUnits.slice(0, 30)) {
      const company = allCompanies.find(c => c.id === bu.companyId);
      summary.push(`- ${bu.name} (Company: ${company?.name || 'Unknown'}, FTE: ${bu.fte || 0})`);
    }
    if (allBusinessUnits.length > 30) summary.push(`  ... and ${allBusinessUnits.length - 30} more business units`);
    
    summary.push(`\nPROCESSES (${allProcesses.length} total):`);
    for (const proc of allProcesses.slice(0, 30)) {
      const company = allCompanies.find(c => c.id === proc.businessId);
      const bu = allBusinessUnits.find(b => b.id === proc.businessUnitId);
      summary.push(`- ${proc.name}`);
      summary.push(`  Company: ${company?.name || 'Unknown'}, Business Unit: ${bu?.name || 'N/A'}`);
    }
    if (allProcesses.length > 30) summary.push(`  ... and ${allProcesses.length - 30} more processes`);
    
    summary.push(`\nPAIN POINTS (${allPainPoints.length} total):`);
    for (const pp of allPainPoints.slice(0, 40)) {
      const company = allCompanies.find(c => c.id === pp.companyId);
      const bu = allBusinessUnits.find(b => b.id === pp.businessUnitId);
      const linkedSolutions = allLinks.filter(l => l.painPointId === pp.id);
      const statement = pp.statement?.substring(0, 100) || 'N/A';
      summary.push(`- "${statement}${pp.statement && pp.statement.length > 100 ? '...' : ''}"`);
      summary.push(`  Company: ${company?.name || 'Unknown'}, BU: ${bu?.name || 'N/A'}, Linked: ${linkedSolutions.length}`);
    }
    if (allPainPoints.length > 40) summary.push(`  ... and ${allPainPoints.length - 40} more pain points`);
    
    summary.push(`\nSOLUTIONS/USE CASES (${allUseCases.length} total):`);
    for (const uc of allUseCases.slice(0, 30)) {
      summary.push(`- ${uc.name} (Provider: ${uc.solutionProvider || 'N/A'}, Complexity: ${uc.complexity})`);
    }
    if (allUseCases.length > 30) summary.push(`  ... and ${allUseCases.length - 30} more solutions`);
    
    summary.push("\n=== END DATABASE CONTEXT ===");
    
    let result = summary.join('\n');
    if (result.length > MAX_CONTEXT_CHARS) {
      result = result.substring(0, MAX_CONTEXT_CHARS) + "\n... [context truncated for length]";
    }
    
    cachedDataSummary = result;
    cacheTimestamp = Date.now();
    console.log(`[AI] Data summary cached: ${result.length} chars, ~${estimateTokens(result)} tokens`);
    
    return result;
  } catch (error) {
    console.error("Error fetching data summary:", error);
    return "Unable to fetch database summary.";
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

    const dataSummary = await getDataSummary();
    
    const messagesText = limitedMessages.map(m => m.content).join(' ');
    const systemPromptEstimate = 500;
    const totalTokenEstimate = estimateTokens(dataSummary) + estimateTokens(messagesText) + systemPromptEstimate;
    console.log(`[AI] Streaming request: ${limitedMessages.length} messages, ~${totalTokenEstimate} tokens total`);
    
    if (totalTokenEstimate > 12000) {
      console.warn(`[AI] Warning: Token estimate ${totalTokenEstimate} approaching limit`);
    }
    
    const enrichedConfig: AIConfig = {
      ...config,
      dataContext: dataSummary,
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
