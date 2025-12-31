import { Router } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  businessUnits,
  companies,
  painPoints,
  processPainPoints,
  processUseCases,
  processes,
  useCases
} from "../db/schema.js";
import { parseOptionalNumberOrUndefined, normalizeIdArray } from "../utils/parsing.js";
import { isEditorOrAdmin } from "../simpleAuth.js";
import { logCreate, logUpdate, logDelete, getAuditContext } from "../services/auditLog.js";

const router = Router();

const replaceProcessLinks = async (
  processId: string,
  painPointIds: string[],
  useCaseIds: string[]
) => {
  await db.transaction(async (tx) => {
    await tx.delete(processPainPoints).where(eq(processPainPoints.processId, processId));
    await tx.delete(processUseCases).where(eq(processUseCases.processId, processId));

    if (painPointIds.length > 0) {
      const uniquePainPoints = Array.from(new Set(painPointIds));
      await tx.insert(processPainPoints).values(
        uniquePainPoints.map((painPointId) => ({ processId, painPointId }))
      );
    }

    if (useCaseIds.length > 0) {
      const uniqueUseCases = Array.from(new Set(useCaseIds));
      await tx.insert(processUseCases).values(uniqueUseCases.map((useCaseId) => ({ processId, useCaseId })));
    }
  });
};

router.get("/", async (req, res) => {
  const businessUnitId = String(req.query.businessUnitId ?? "").trim();
  const companyId = String(req.query.companyId ?? "").trim();

  try {
    const baseQuery = db
      .select({
        id: processes.id,
        businessId: processes.businessId,
        businessUnitId: processes.businessUnitId,
        businessUnitName: businessUnits.name,
        companyName: companies.name,
        name: processes.name,
        description: processes.description,
        volume: processes.volume,
        volumeUnit: processes.volumeUnit,
        fte: processes.fte,
        owner: processes.owner,
        painPointCount: sql<number>`coalesce((SELECT count(*)::int FROM process_pain_points p WHERE p.process_id = ${processes.id}), 0)`,
        useCaseCount: sql<number>`coalesce((SELECT count(*)::int FROM process_use_cases u WHERE u.process_id = ${processes.id}), 0)`
      })
      .from(processes)
      .leftJoin(businessUnits, eq(processes.businessUnitId, businessUnits.id))
      .leftJoin(companies, eq(processes.businessId, companies.id))
      .orderBy(asc(processes.name));

    const conditions = [];
    if (businessUnitId) {
      conditions.push(eq(processes.businessUnitId, businessUnitId));
    } else if (companyId) {
      conditions.push(eq(processes.businessId, companyId));
    }

    const records = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

    res.json(records);
  } catch (error) {
    console.error("[Processes GET /] Error:", error);
    res.status(500).json({ message: "Failed to fetch processes" });
  }
});

router.post("/", isEditorOrAdmin, async (req, res) => {
  const {
    name: rawName,
    description,
    volume,
    volumeUnit,
    fte,
    owner,
    businessUnitId,
    painPointIds,
    useCaseIds
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "Name must not be empty" });
  }

  try {
    const [unit] = await db
      .select({ id: businessUnits.id, companyId: businessUnits.companyId })
      .from(businessUnits)
      .innerJoin(companies, eq(companies.id, businessUnits.companyId))
      .where(eq(businessUnits.id, businessUnitId));

    if (!unit) {
      return res.status(400).json({ message: "Invalid businessUnitId" });
    }

    const volumeValue = parseOptionalNumberOrUndefined(volume, "Volume");
    const fteValue = parseOptionalNumberOrUndefined(fte, "FTE");

    const [created] = await db
      .insert(processes)
      .values({
        businessId: unit.companyId,
        businessUnitId,
        name,
        description,
        volume: volumeValue != null ? String(volumeValue) : null,
        volumeUnit,
        fte: fteValue != null ? String(fteValue) : null,
        owner
      })
      .returning();

    await replaceProcessLinks(created.id, normalizeIdArray(painPointIds), normalizeIdArray(useCaseIds));

    await logCreate("process", created.id, created.name, created as Record<string, unknown>, await getAuditContext(req as any));

    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create process";
    res.status(400).json({ message });
  }
});

router.put("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name: rawName,
    description,
    volume,
    volumeUnit,
    fte,
    owner,
    painPointIds,
    useCaseIds
  } = req.body ?? {};

  const name = (rawName ?? "").trim();
  if (!name) {
    return res.status(400).json({ message: "Name must not be empty" });
  }

  let volumeValue: number | undefined;
  let fteValue: number | undefined;

  try {
    volumeValue = parseOptionalNumberOrUndefined(volume, "Volume");
    fteValue = parseOptionalNumberOrUndefined(fte, "FTE");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid numeric field";
    return res.status(400).json({ message });
  }

  try {
    const [existing] = await db.select().from(processes).where(eq(processes.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Process not found" });
    }

    const [updated] = await db
      .update(processes)
      .set({
        name,
        description,
        volume: volumeValue != null ? String(volumeValue) : null,
        volumeUnit,
        fte: fteValue != null ? String(fteValue) : null,
        owner
      })
      .where(and(
        eq(processes.id, id), 
        existing.businessUnitId ? eq(processes.businessUnitId, existing.businessUnitId) : isNull(processes.businessUnitId)
      ))
      .returning();

    await replaceProcessLinks(id, normalizeIdArray(painPointIds), normalizeIdArray(useCaseIds));

    await logUpdate("process", id, updated.name, existing as Record<string, unknown>, updated as Record<string, unknown>, await getAuditContext(req as any));

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update process";
    res.status(400).json({ message });
  }
});

router.delete("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(processes).where(eq(processes.id, id));
    
    if (!existing) {
      return res.status(404).json({ message: "Process not found" });
    }

    await db.transaction(async (tx) => {
      await tx.delete(processPainPoints).where(eq(processPainPoints.processId, id));
      await tx.delete(processUseCases).where(eq(processUseCases.processId, id));
      await tx.delete(processes).where(eq(processes.id, id));
    });

    await logDelete("process", id, existing.name, existing as Record<string, unknown>, await getAuditContext(req as any));

    res.json({ message: "Process deleted" });
  } catch (error) {
    console.error("[Processes DELETE /:id] Error:", error);
    res.status(500).json({ message: "Failed to delete process" });
  }
});

router.get("/links/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const painPointLinks = await db
      .select({ painPointId: processPainPoints.painPointId })
      .from(processPainPoints)
      .where(eq(processPainPoints.processId, id));

    const useCaseLinks = await db
      .select({ useCaseId: processUseCases.useCaseId })
      .from(processUseCases)
      .where(eq(processUseCases.processId, id));

    res.json({
      painPointIds: painPointLinks.map((row) => row.painPointId),
      useCaseIds: useCaseLinks.map((row) => row.useCaseId)
    });
  } catch (error) {
    console.error("[Processes GET /links/:id] Error:", error);
    res.status(500).json({ message: "Failed to load linked records" });
  }
});

router.get("/options", async (_req, res) => {
  try {
    const [painPointOptions, useCaseOptions] = await Promise.all([
      db.select({ id: painPoints.id, statement: painPoints.statement }).from(painPoints).orderBy(asc(painPoints.statement)),
      db.select({ id: useCases.id, name: useCases.name }).from(useCases).orderBy(asc(useCases.name))
    ]);

    res.json({ painPoints: painPointOptions, useCases: useCaseOptions });
  } catch (error) {
    console.error("[Processes GET /options] Error:", error);
    res.status(500).json({ message: "Failed to load process options" });
  }
});

export default router;
