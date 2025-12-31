import { Router } from "express";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { isAdmin } from "../simpleAuth.js";

const router = Router();

router.get("/", isAdmin, async (req, res) => {
  try {
    const { 
      entityType, 
      entityId,
      action, 
      userId,
      startDate,
      endDate,
      limit = "100",
      offset = "0"
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 100, 500);
    const offsetNum = parseInt(offset as string) || 0;

    const conditions = [];
    
    if (entityType && typeof entityType === 'string') {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    
    if (entityId && typeof entityId === 'string') {
      conditions.push(eq(auditLogs.entityId, entityId));
    }
    
    if (action && typeof action === 'string') {
      conditions.push(eq(auditLogs.action, action));
    }
    
    if (userId && typeof userId === 'string') {
      conditions.push(eq(auditLogs.userId, userId));
    }
    
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitNum)
        .offset(offsetNum),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(whereClause)
    ]);

    res.json({
      logs: results,
      total: countResult[0]?.count || 0,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

router.get("/summary", isAdmin, async (_req, res) => {
  try {
    const [entityTypes, actions, recentActivity] = await Promise.all([
      db
        .select({ 
          entityType: auditLogs.entityType, 
          count: sql<number>`count(*)::int` 
        })
        .from(auditLogs)
        .groupBy(auditLogs.entityType),
      db
        .select({ 
          action: auditLogs.action, 
          count: sql<number>`count(*)::int` 
        })
        .from(auditLogs)
        .groupBy(auditLogs.action),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(gte(auditLogs.createdAt, sql`NOW() - INTERVAL '24 hours'`))
    ]);

    res.json({
      entityTypes,
      actions,
      recentActivityCount: recentActivity[0]?.count || 0
    });
  } catch (error) {
    console.error("Failed to fetch audit summary:", error);
    res.status(500).json({ message: "Failed to fetch audit summary" });
  }
});

router.get("/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id));

    if (!log) {
      return res.status(404).json({ message: "Audit log not found" });
    }

    res.json(log);
  } catch (error) {
    console.error("Failed to fetch audit log:", error);
    res.status(500).json({ message: "Failed to fetch audit log" });
  }
});

export default router;
