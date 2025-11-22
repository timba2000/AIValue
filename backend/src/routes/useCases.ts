import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { processes, useCases } from "../db/schema.js";

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
        description: useCases.description,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        valueDrivers: useCases.valueDrivers,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedFTEHours: useCases.estimatedFTEHours,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        roiEstimate: useCases.roiEstimate,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .orderBy(desc(useCases.createdAt));

    res.json(results);
  } catch (error) {
    console.error("Failed to fetch use cases", error);
    res.status(500).json({ message: "Failed to fetch use cases" });
  }
});

router.post("/", async (req, res) => {
  const {
    name: rawName,
    description,
    problemToSolve,
    solutionOverview,
    expectedBenefits,
    valueDrivers,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedFTEHours,
    estimatedDeliveryTime,
    costRange,
    roiEstimate,
    confidenceLevel,
    processId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity || !processId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let estimatedHours: number | null = null;

  try {
    estimatedHours = parseOptionalNumber(estimatedFTEHours, "estimatedFTEHours");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  try {
    const [created] = await db
      .insert(useCases)
      .values({
        name,
        description,
        problemToSolve,
        solutionOverview,
        expectedBenefits,
        valueDrivers,
        complexity,
        dataRequirements,
        systemsImpacted,
        risks,
        estimatedFTEHours: estimatedHours != null ? String(estimatedHours) : null,
        estimatedDeliveryTime,
        costRange,
        roiEstimate,
        confidenceLevel,
        processId
      })
      .returning();

    const [withProcess] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        description: useCases.description,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        valueDrivers: useCases.valueDrivers,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedFTEHours: useCases.estimatedFTEHours,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        roiEstimate: useCases.roiEstimate,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .where(eq(useCases.id, created.id));

    res.status(201).json(withProcess);
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name: rawName,
    description,
    problemToSolve,
    solutionOverview,
    expectedBenefits,
    valueDrivers,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedFTEHours,
    estimatedDeliveryTime,
    costRange,
    roiEstimate,
    confidenceLevel,
    processId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity || !processId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let estimatedHours: number | null = null;

  try {
    estimatedHours = parseOptionalNumber(estimatedFTEHours, "estimatedFTEHours");
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
        description,
        problemToSolve,
        solutionOverview,
        expectedBenefits,
        valueDrivers,
        complexity,
        dataRequirements,
        systemsImpacted,
        risks,
        estimatedFTEHours: estimatedHours != null ? String(estimatedHours) : null,
        estimatedDeliveryTime,
        costRange,
        roiEstimate,
        confidenceLevel,
        processId
      })
      .where(and(eq(useCases.id, id), eq(useCases.processId, existing.processId)));

    const [updated] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        description: useCases.description,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        expectedBenefits: useCases.expectedBenefits,
        valueDrivers: useCases.valueDrivers,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedFTEHours: useCases.estimatedFTEHours,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        roiEstimate: useCases.roiEstimate,
        confidenceLevel: useCases.confidenceLevel,
        processId: useCases.processId,
        createdAt: useCases.createdAt,
        processName: processes.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .where(eq(useCases.id, id));

    res.json(updated);
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

export default router;
