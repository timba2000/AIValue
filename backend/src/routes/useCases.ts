import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { processes, useCases, painPointUseCases, painPoints } from "../db/schema.js";

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
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .orderBy(desc(useCases.createdAt));

    const formatted = results.map((r) => ({
      ...r,
      expectedBenefits: r.expectedBenefits !== null ? Number(r.expectedBenefits) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Failed to fetch use cases", error);
    res.status(500).json({ message: "Failed to fetch use cases" });
  }
});

router.post("/", async (req, res) => {
  const {
    name: rawName,
    solutionProvider,
    problemToSolve,
    solutionOverview,
    expectedBenefits,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedDeliveryTime,
    costRange,
    confidenceLevel,
    processId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let benefitsValue: number | null = null;

  try {
    benefitsValue = parseOptionalNumber(expectedBenefits, "expectedBenefits");
    if (benefitsValue !== null && (benefitsValue < 0 || benefitsValue > 100)) {
      return res.status(400).json({ message: "expectedBenefits must be between 0 and 100" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  try {
    const [created] = await db
      .insert(useCases)
      .values({
        name,
        solutionProvider: solutionProvider || null,
        problemToSolve,
        solutionOverview,
        expectedBenefits: benefitsValue !== null ? String(benefitsValue) : null,
        complexity,
        dataRequirements: dataRequirements || null,
        systemsImpacted: systemsImpacted || null,
        risks: risks || null,
        estimatedDeliveryTime: estimatedDeliveryTime || null,
        costRange: costRange || null,
        confidenceLevel: confidenceLevel || null,
        processId: processId || null
      })
      .returning();

    const [withProcess] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .where(eq(useCases.id, created.id));

    res.status(201).json({
      ...withProcess,
      expectedBenefits: withProcess.expectedBenefits !== null ? Number(withProcess.expectedBenefits) : null
    });
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name: rawName,
    solutionProvider,
    problemToSolve,
    solutionOverview,
    expectedBenefits,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedDeliveryTime,
    costRange,
    confidenceLevel,
    processId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let benefitsValue: number | null = null;

  try {
    benefitsValue = parseOptionalNumber(expectedBenefits, "expectedBenefits");
    if (benefitsValue !== null && (benefitsValue < 0 || benefitsValue > 100)) {
      return res.status(400).json({ message: "expectedBenefits must be between 0 and 100" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  try {
    const [existing] = await db.select().from(useCases).where(eq(useCases.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Use case not found" });
    }

    await db
      .update(useCases)
      .set({
        name,
        solutionProvider: solutionProvider || null,
        problemToSolve,
        solutionOverview,
        expectedBenefits: benefitsValue !== null ? String(benefitsValue) : null,
        complexity,
        dataRequirements: dataRequirements || null,
        systemsImpacted: systemsImpacted || null,
        risks: risks || null,
        estimatedDeliveryTime: estimatedDeliveryTime || null,
        costRange: costRange || null,
        confidenceLevel: confidenceLevel || null,
        processId: processId || null
      })
      .where(eq(useCases.id, id));

    const [updated] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .where(eq(useCases.id, id));

    res.json({
      ...updated,
      expectedBenefits: updated.expectedBenefits !== null ? Number(updated.expectedBenefits) : null
    });
  } catch (error) {
    console.error("Failed to update use case", error);
    res.status(500).json({ message: "Failed to update use case" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(useCases).where(eq(useCases.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Use case not found" });
    }

    await db.delete(useCases).where(eq(useCases.id, id));
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete use case", error);
    res.status(500).json({ message: "Failed to delete use case" });
  }
});

router.get("/:id/pain-points", async (req, res) => {
  try {
    const { id } = req.params;

    const links = await db
      .select({
        id: painPointUseCases.id,
        painPointId: painPointUseCases.painPointId,
        useCaseId: painPointUseCases.useCaseId,
        percentageSolved: painPointUseCases.percentageSolved,
        notes: painPointUseCases.notes,
        createdAt: painPointUseCases.createdAt,
        painPointStatement: painPoints.statement,
        painPointMagnitude: painPoints.magnitude,
        painPointRiskLevel: painPoints.riskLevel,
        painPointTotalHours: painPoints.totalHoursPerMonth,
        painPointFteCount: painPoints.fteCount
      })
      .from(painPointUseCases)
      .leftJoin(painPoints, eq(painPointUseCases.painPointId, painPoints.id))
      .where(eq(painPointUseCases.useCaseId, id))
      .orderBy(desc(painPointUseCases.createdAt));

    const formatted = links.map((link) => ({
      ...link,
      percentageSolved: link.percentageSolved !== null ? Number(link.percentageSolved) : null,
      painPointMagnitude: link.painPointMagnitude !== null ? Number(link.painPointMagnitude) : null,
      painPointTotalHours: link.painPointTotalHours !== null ? Number(link.painPointTotalHours) : null,
      painPointFteCount: link.painPointFteCount !== null ? Number(link.painPointFteCount) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Failed to fetch use case pain points", error);
    res.status(500).json({ message: "Failed to fetch use case pain points" });
  }
});

export default router;
