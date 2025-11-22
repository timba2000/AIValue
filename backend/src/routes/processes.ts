import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  businessUnits,
  companies,
  painPoints,
  processPainPoints,
  processUseCases,
  processes,
  useCases
} from "../db/schema";

const router = Router();

const parseOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a number`);
  }
  return parsed;
};

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

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

  try {
    const query = db
      .select({
        id: processes.id,
        businessId: processes.businessId,
        businessUnitId: processes.businessUnitId,
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
      .orderBy(asc(processes.name));

    const records = businessUnitId
      ? await query.where(eq(processes.businessUnitId, businessUnitId))
      : await query;

    res.json(records);
  } catch (error) {
    console.error("Failed to fetch processes", error);
    res.status(500).json({ message: "Failed to fetch processes" });
  }
});

router.post("/", async (req, res) => {
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

    const volumeValue = parseOptionalNumber(volume, "Volume");
    const fteValue = parseOptionalNumber(fte, "FTE");

    const [created] = await db
      .insert(processes)
      .values({
        businessId: unit.companyId,
        businessUnitId,
        name,
        description,
        volume: volumeValue ?? null,
        volumeUnit,
        fte: fteValue ?? null,
        owner
      })
      .returning();

    await replaceProcessLinks(created.id, normalizeIdArray(painPointIds), normalizeIdArray(useCaseIds));

    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create process";
    console.error("Failed to create process", error);
    res.status(400).json({ message });
  }
});

router.put("/:id", async (req, res) => {
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
    volumeValue = parseOptionalNumber(volume, "Volume");
    fteValue = parseOptionalNumber(fte, "FTE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric field";
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
        volume: volumeValue ?? null,
        volumeUnit,
        fte: fteValue ?? null,
        owner
      })
      .where(and(eq(processes.id, id), eq(processes.businessUnitId, existing.businessUnitId)))
      .returning();

    await replaceProcessLinks(id, normalizeIdArray(painPointIds), normalizeIdArray(useCaseIds));

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update process";
    console.error("Failed to update process", error);
    res.status(400).json({ message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(processPainPoints).where(eq(processPainPoints.processId, id));
      await tx.delete(processUseCases).where(eq(processUseCases.processId, id));
      await tx.delete(processes).where(eq(processes.id, id));
    });

    res.json({ message: "Process deleted" });
  } catch (error) {
    console.error("Failed to delete process", error);
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
    console.error("Failed to load linked records", error);
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
    console.error("Failed to load process options", error);
    res.status(500).json({ message: "Failed to load process options" });
  }
});

export default router;
