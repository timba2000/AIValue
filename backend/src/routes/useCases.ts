import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { processes, useCases, painPointUseCases, painPoints, companies, businessUnits } from "../db/schema.js";
import { parseOptionalNumber } from "../utils/parsing.js";
import { isEditorOrAdmin } from "../simpleAuth.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        alphaType: useCases.alphaType,
        processId: useCases.processId,
        companyId: useCases.companyId,
        businessUnitId: useCases.businessUnitId,
        createdAt: useCases.createdAt,
        processName: processes.name,
        companyName: companies.name,
        businessUnitName: businessUnits.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .leftJoin(companies, eq(useCases.companyId, companies.id))
      .leftJoin(businessUnits, eq(useCases.businessUnitId, businessUnits.id))
      .orderBy(desc(useCases.createdAt));

    res.json(results);
  } catch {
    
    res.status(500).json({ message: "Failed to fetch use cases" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        alphaType: useCases.alphaType,
        processId: useCases.processId,
        companyId: useCases.companyId,
        businessUnitId: useCases.businessUnitId,
        createdAt: useCases.createdAt,
        processName: processes.name,
        companyName: companies.name,
        businessUnitName: businessUnits.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .leftJoin(companies, eq(useCases.companyId, companies.id))
      .leftJoin(businessUnits, eq(useCases.businessUnitId, businessUnits.id))
      .where(eq(useCases.id, id));

    if (!result) {
      return res.status(404).json({ message: "Use case not found" });
    }

    res.json(result);
  } catch {
    
    res.status(500).json({ message: "Failed to fetch use case" });
  }
});

router.post("/", isEditorOrAdmin, async (req, res) => {
  const {
    name: rawName,
    solutionProvider,
    problemToSolve,
    solutionOverview,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedDeliveryTime,
    costRange,
    confidenceLevel,
    alphaType,
    processId,
    companyId,
    businessUnitId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [created] = await db
      .insert(useCases)
      .values({
        name,
        solutionProvider: solutionProvider || null,
        problemToSolve,
        solutionOverview,
        complexity,
        dataRequirements: dataRequirements || null,
        systemsImpacted: systemsImpacted || null,
        risks: risks || null,
        estimatedDeliveryTime: estimatedDeliveryTime || null,
        costRange: costRange || null,
        confidenceLevel: confidenceLevel || null,
        alphaType: alphaType || null,
        processId: processId || null,
        companyId: companyId || null,
        businessUnitId: businessUnitId || null
      })
      .returning();

    const [withProcess] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        alphaType: useCases.alphaType,
        processId: useCases.processId,
        companyId: useCases.companyId,
        businessUnitId: useCases.businessUnitId,
        createdAt: useCases.createdAt,
        processName: processes.name,
        companyName: companies.name,
        businessUnitName: businessUnits.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .leftJoin(companies, eq(useCases.companyId, companies.id))
      .leftJoin(businessUnits, eq(useCases.businessUnitId, businessUnits.id))
      .where(eq(useCases.id, created.id));

    res.status(201).json(withProcess);
  } catch {
    
    res.status(500).json({ message: "Failed to create use case" });
  }
});

router.put("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name: rawName,
    solutionProvider,
    problemToSolve,
    solutionOverview,
    complexity,
    dataRequirements,
    systemsImpacted,
    risks,
    estimatedDeliveryTime,
    costRange,
    confidenceLevel,
    alphaType,
    processId,
    companyId,
    businessUnitId
  } = req.body ?? {};

  const name = (rawName ?? "").trim();

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!problemToSolve || !solutionOverview || !complexity) {
    return res.status(400).json({ message: "Missing required fields" });
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
        complexity,
        dataRequirements: dataRequirements || null,
        systemsImpacted: systemsImpacted || null,
        risks: risks || null,
        estimatedDeliveryTime: estimatedDeliveryTime || null,
        costRange: costRange || null,
        confidenceLevel: confidenceLevel || null,
        alphaType: alphaType || null,
        processId: processId || null,
        companyId: companyId || null,
        businessUnitId: businessUnitId || null
      })
      .where(eq(useCases.id, id));

    const [updated] = await db
      .select({
        id: useCases.id,
        name: useCases.name,
        solutionProvider: useCases.solutionProvider,
        problemToSolve: useCases.problemToSolve,
        solutionOverview: useCases.solutionOverview,
        complexity: useCases.complexity,
        dataRequirements: useCases.dataRequirements,
        systemsImpacted: useCases.systemsImpacted,
        risks: useCases.risks,
        estimatedDeliveryTime: useCases.estimatedDeliveryTime,
        costRange: useCases.costRange,
        confidenceLevel: useCases.confidenceLevel,
        alphaType: useCases.alphaType,
        processId: useCases.processId,
        companyId: useCases.companyId,
        businessUnitId: useCases.businessUnitId,
        createdAt: useCases.createdAt,
        processName: processes.name,
        companyName: companies.name,
        businessUnitName: businessUnits.name
      })
      .from(useCases)
      .leftJoin(processes, eq(useCases.processId, processes.id))
      .leftJoin(companies, eq(useCases.companyId, companies.id))
      .leftJoin(businessUnits, eq(useCases.businessUnitId, businessUnits.id))
      .where(eq(useCases.id, id));

    res.json(updated);
  } catch {
    
    res.status(500).json({ message: "Failed to update use case" });
  }
});

router.delete("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(useCases).where(eq(useCases.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Use case not found" });
    }

    await db.delete(useCases).where(eq(useCases.id, id));
    res.status(204).send();
  } catch {
    
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
  } catch {
    
    res.status(500).json({ message: "Failed to fetch use case pain points" });
  }
});

export default router;
