import { Router } from "express";
import { asc, desc, eq, sql, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { painPoints, processPainPoints } from "../db/schema.js";

const router = Router();

const parseOptionalNumber = (value: unknown, field: string): number | null => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number`);
  }
  return parsed;
};

router.get("/", async (_req, res) => {
  try {
    const results = await db
      .select()
      .from(painPoints)
      .orderBy(desc(painPoints.createdAt));

    const painPointIds = results.map((pp) => pp.id);
    const processLinks = painPointIds.length > 0
      ? await db
          .select({
            painPointId: processPainPoints.painPointId,
            processId: processPainPoints.processId
          })
          .from(processPainPoints)
          .where(inArray(processPainPoints.painPointId, painPointIds))
      : [];

    const processLinkMap = processLinks.reduce((acc, link) => {
      if (!acc[link.painPointId]) {
        acc[link.painPointId] = [];
      }
      acc[link.painPointId].push(link.processId);
      return acc;
    }, {} as Record<string, string[]>);

    const resultsWithProcessIds = results.map((pp) => ({
      ...pp,
      processIds: processLinkMap[pp.id] || []
    }));

    res.json(resultsWithProcessIds);
  } catch (error) {
    console.error("Failed to fetch pain points", error);
    res.status(500).json({ message: "Failed to fetch pain points" });
  }
});

router.post("/", async (req, res) => {
  const {
    statement,
    impactType,
    businessImpact,
    magnitude,
    frequency,
    timePerUnit,
    fteCount,
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    effortSolving,
    processIds
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let effortNum: number | null = null;
  let timePerUnitNum: number | null = null;
  let fteCountNum: number | null = null;
  let totalHoursPerMonth: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    effortNum = parseOptionalNumber(effortSolving, "effortSolving");
    timePerUnitNum = parseOptionalNumber(timePerUnit, "timePerUnit");
    fteCountNum = parseOptionalNumber(fteCount, "fteCount");
    
    if (frequencyNum != null && timePerUnitNum != null) {
      totalHoursPerMonth = frequencyNum * timePerUnitNum;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  const impactTypeArray = Array.isArray(impactType) ? impactType.filter(Boolean) : (impactType ? [impactType] : null);

  try {
    const processIdsArray = Array.isArray(processIds) ? processIds.filter(Boolean) : [];
    
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(painPoints)
        .values({
          statement: statementText,
          impactType: impactTypeArray && impactTypeArray.length > 0 ? impactTypeArray : null,
          businessImpact: businessImpact || null,
          magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
          frequency: frequencyNum != null ? String(frequencyNum) : null,
          timePerUnit: timePerUnitNum != null ? String(timePerUnitNum) : null,
          totalHoursPerMonth: totalHoursPerMonth != null ? String(totalHoursPerMonth) : null,
          fteCount: fteCountNum != null ? String(fteCountNum) : null,
          rootCause: rootCause || null,
          workarounds: workarounds || null,
          dependencies: dependencies || null,
          riskLevel: riskLevel || null,
          effortSolving: effortNum != null ? String(effortNum) : null
        })
        .returning();

      if (processIdsArray.length > 0) {
        const uniqueProcessIds = Array.from(new Set(processIdsArray));
        await tx.insert(processPainPoints).values(
          uniqueProcessIds.map((processId) => ({ painPointId: created.id, processId }))
        );
      }

      return created;
    });

    res.status(201).json({ ...result, processIds: processIdsArray });
  } catch (error) {
    console.error("Failed to create pain point", error);
    res.status(500).json({ message: "Failed to create pain point" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    statement,
    impactType,
    businessImpact,
    magnitude,
    frequency,
    timePerUnit,
    fteCount,
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    effortSolving,
    processIds
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let effortNum: number | null = null;
  let timePerUnitNum: number | null = null;
  let fteCountNum: number | null = null;
  let totalHoursPerMonth: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    effortNum = parseOptionalNumber(effortSolving, "effortSolving");
    timePerUnitNum = parseOptionalNumber(timePerUnit, "timePerUnit");
    fteCountNum = parseOptionalNumber(fteCount, "fteCount");
    
    if (frequencyNum != null && timePerUnitNum != null) {
      totalHoursPerMonth = frequencyNum * timePerUnitNum;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  const impactTypeArray = Array.isArray(impactType) ? impactType.filter(Boolean) : (impactType ? [impactType] : null);

  try {
    const [existing] = await db.select().from(painPoints).where(eq(painPoints.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Pain point not found" });
    }

    const processIdsArray = Array.isArray(processIds) ? processIds.filter(Boolean) : [];

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(painPoints)
        .set({
          statement: statementText,
          impactType: impactTypeArray && impactTypeArray.length > 0 ? impactTypeArray : null,
          businessImpact: businessImpact || null,
          magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
          frequency: frequencyNum != null ? String(frequencyNum) : null,
          timePerUnit: timePerUnitNum != null ? String(timePerUnitNum) : null,
          totalHoursPerMonth: totalHoursPerMonth != null ? String(totalHoursPerMonth) : null,
          fteCount: fteCountNum != null ? String(fteCountNum) : null,
          rootCause: rootCause || null,
          workarounds: workarounds || null,
          dependencies: dependencies || null,
          riskLevel: riskLevel || null,
          effortSolving: effortNum != null ? String(effortNum) : null
        })
        .where(eq(painPoints.id, id))
        .returning();

      await tx.delete(processPainPoints).where(eq(processPainPoints.painPointId, id));

      if (processIdsArray.length > 0) {
        const uniqueProcessIds = Array.from(new Set(processIdsArray));
        await tx.insert(processPainPoints).values(
          uniqueProcessIds.map((processId) => ({ painPointId: id, processId }))
        );
      }

      return updated;
    });

    res.json({ ...result, processIds: processIdsArray });
  } catch (error) {
    console.error("Failed to update pain point", error);
    res.status(500).json({ message: "Failed to update pain point" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(painPoints).where(eq(painPoints.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Pain point not found" });
    }

    await db.delete(painPoints).where(eq(painPoints.id, id));
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete pain point", error);
    res.status(500).json({ message: "Failed to delete pain point" });
  }
});

export default router;
