import { Router } from "express";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { isAdmin } from "../simpleAuth.js";
import ExcelJS from "exceljs";

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

router.get("/export/excel", isAdmin, async (req, res) => {
  try {
    const { 
      entityType, 
      action, 
      startDate,
      endDate
    } = req.query;

    const conditions = [];
    
    if (entityType && typeof entityType === 'string') {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    
    if (action && typeof action === 'string') {
      conditions.push(eq(auditLogs.action, action));
    }
    
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Audit Logs");

    worksheet.columns = [
      { header: "Timestamp", key: "createdAt", width: 22 },
      { header: "Entity Type", key: "entityType", width: 15 },
      { header: "Entity Name", key: "entityName", width: 30 },
      { header: "Action", key: "action", width: 12 },
      { header: "User", key: "userName", width: 25 },
      { header: "Changes", key: "changes", width: 60 },
      { header: "Entity ID", key: "entityId", width: 38 },
      { header: "IP Address", key: "ipAddress", width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };

    for (const log of results) {
      const changes = log.changes as Array<{ field: string; oldValue: unknown; newValue: unknown }> | null;
      let changesText = "";
      
      if (changes && Array.isArray(changes)) {
        changesText = changes.map(c => {
          const oldVal = c.oldValue !== null && c.oldValue !== undefined ? String(c.oldValue) : "(empty)";
          const newVal = c.newValue !== null && c.newValue !== undefined ? String(c.newValue) : "(empty)";
          return `${c.field}: ${oldVal} → ${newVal}`;
        }).join("; ");
      }

      worksheet.addRow({
        createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString() : "",
        entityType: log.entityType,
        entityName: log.entityName || "",
        action: log.action,
        userName: log.userName || "Unknown",
        changes: changesText,
        entityId: log.entityId,
        ipAddress: log.ipAddress || ""
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Failed to export audit logs:", error);
    res.status(500).json({ message: "Failed to export audit logs" });
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
