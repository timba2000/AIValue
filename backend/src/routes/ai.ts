import { Router, Request, Response } from "express";
import { generateChatResponse, ChatMessage, AIConfig } from "../services/aiService.js";
import { db } from "../db/client.js";
import { companies, businessUnits, processes, painPoints, useCases, painPointUseCases, aiConversations, aiMessages } from "../db/schema.js";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { getUser } from "../simpleAuth.js";

const router = Router();

async function getDataSummary(): Promise<string> {
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
    for (const company of allCompanies) {
      const companyBUs = allBusinessUnits.filter(bu => bu.companyId === company.id);
      const companyProcesses = allProcesses.filter(p => p.businessId === company.id);
      const companyPainPoints = allPainPoints.filter(pp => pp.companyId === company.id);
      summary.push(`- ${company.name} (Industry: ${company.industry || 'N/A'})`);
      summary.push(`  Business Units: ${companyBUs.length}, Processes: ${companyProcesses.length}, Pain Points: ${companyPainPoints.length}`);
    }
    
    summary.push(`\nBUSINESS UNITS (${allBusinessUnits.length} total):`);
    for (const bu of allBusinessUnits) {
      const company = allCompanies.find(c => c.id === bu.companyId);
      summary.push(`- ${bu.name} (Company: ${company?.name || 'Unknown'}, FTE: ${bu.fte || 0})`);
    }
    
    summary.push(`\nPROCESSES (${allProcesses.length} total):`);
    for (const proc of allProcesses) {
      const company = allCompanies.find(c => c.id === proc.businessId);
      const bu = allBusinessUnits.find(b => b.id === proc.businessUnitId);
      summary.push(`- ${proc.name}`);
      summary.push(`  Company: ${company?.name || 'Unknown'}, Business Unit: ${bu?.name || 'N/A'}`);
      if (proc.description) summary.push(`  Description: ${proc.description}`);
    }
    
    summary.push(`\nPAIN POINTS (${allPainPoints.length} total):`);
    for (const pp of allPainPoints) {
      const company = allCompanies.find(c => c.id === pp.companyId);
      const bu = allBusinessUnits.find(b => b.id === pp.businessUnitId);
      const linkedSolutions = allLinks.filter(l => l.painPointId === pp.id);
      summary.push(`- "${pp.statement}"`);
      summary.push(`  Company: ${company?.name || 'Unknown'}, Business Unit: ${bu?.name || 'N/A'}`);
      summary.push(`  Magnitude: ${pp.magnitude || 'N/A'}, Frequency: ${pp.frequency || 'N/A'}, Hours/Month: ${pp.totalHoursPerMonth || 'N/A'}`);
      summary.push(`  Impact Type: ${pp.impactType?.join(', ') || 'N/A'}, Risk Level: ${pp.riskLevel || 'N/A'}`);
      summary.push(`  Linked Solutions: ${linkedSolutions.length}`);
    }
    
    summary.push(`\nSOLUTIONS/USE CASES (${allUseCases.length} total):`);
    for (const uc of allUseCases) {
      const linkedPainPoints = allLinks.filter(l => l.useCaseId === uc.id);
      summary.push(`- ${uc.name} (Provider: ${uc.solutionProvider || 'N/A'})`);
      summary.push(`  Problem: ${uc.problemToSolve}`);
      summary.push(`  Solution: ${uc.solutionOverview}`);
      summary.push(`  Complexity: ${uc.complexity}, Cost: ${uc.costRange || 'N/A'}, Delivery: ${uc.estimatedDeliveryTime || 'N/A'}`);
      summary.push(`  Linked Pain Points: ${linkedPainPoints.length}`);
    }
    
    summary.push("\n=== END DATABASE CONTEXT ===");
    
    return summary.join('\n');
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

    const dataSummary = await getDataSummary();
    
    const enrichedConfig: AIConfig = {
      ...config,
      dataContext: dataSummary,
    };

    const response = await generateChatResponse(messages, enrichedConfig);
    
    res.json({ 
      success: true,
      message: response 
    });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ 
      error: "Failed to generate AI response",
      details: error instanceof Error ? error.message : "Unknown error"
    });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
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
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { role, content } = req.body;

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
      content
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
