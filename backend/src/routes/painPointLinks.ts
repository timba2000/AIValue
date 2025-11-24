import { Router } from "express";
import { db } from "../db/client.js";
import { painPointUseCases, painPoints, useCases } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/pain-points/:painPointId/links", async (req, res) => {
  try {
    const { painPointId } = req.params;

    const links = await db
      .select({
        id: painPointUseCases.id,
        painPointId: painPointUseCases.painPointId,
        useCaseId: painPointUseCases.useCaseId,
        percentageSolved: painPointUseCases.percentageSolved,
        notes: painPointUseCases.notes,
        createdAt: painPointUseCases.createdAt,
        useCaseName: useCases.name,
        useCaseComplexity: useCases.complexity,
        useCaseConfidence: useCases.confidenceLevel
      })
      .from(painPointUseCases)
      .leftJoin(useCases, eq(painPointUseCases.useCaseId, useCases.id))
      .where(eq(painPointUseCases.painPointId, painPointId))
      .orderBy(desc(painPointUseCases.createdAt));

    const formatted = links.map((link) => ({
      ...link,
      percentageSolved: link.percentageSolved !== null ? Number(link.percentageSolved) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Failed to fetch pain point links", error);
    res.status(500).json({ message: "Failed to fetch pain point links" });
  }
});

router.post("/pain-points/:painPointId/links", async (req, res) => {
  try {
    const { painPointId } = req.params;
    const { useCaseId, percentageSolved, notes } = req.body;

    if (!useCaseId) {
      return res.status(400).json({ message: "Use case ID is required" });
    }

    if (percentageSolved !== null && percentageSolved !== undefined) {
      const percent = Number(percentageSolved);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return res.status(400).json({ message: "Percentage solved must be between 0 and 100" });
      }
    }

    const [link] = await db
      .insert(painPointUseCases)
      .values({
        painPointId,
        useCaseId,
        percentageSolved: percentageSolved !== null && percentageSolved !== undefined ? String(percentageSolved) : null,
        notes: notes || null
      })
      .returning();

    const [linkWithUseCase] = await db
      .select({
        id: painPointUseCases.id,
        painPointId: painPointUseCases.painPointId,
        useCaseId: painPointUseCases.useCaseId,
        percentageSolved: painPointUseCases.percentageSolved,
        notes: painPointUseCases.notes,
        createdAt: painPointUseCases.createdAt,
        useCaseName: useCases.name,
        useCaseComplexity: useCases.complexity,
        useCaseConfidence: useCases.confidenceLevel
      })
      .from(painPointUseCases)
      .leftJoin(useCases, eq(painPointUseCases.useCaseId, useCases.id))
      .where(eq(painPointUseCases.id, link.id));

    res.status(201).json({
      ...linkWithUseCase,
      percentageSolved: linkWithUseCase.percentageSolved !== null ? Number(linkWithUseCase.percentageSolved) : null
    });
  } catch (error) {
    console.error("Failed to create pain point link", error);
    res.status(500).json({ message: "Failed to create pain point link" });
  }
});

router.put("/pain-points/:painPointId/links/:linkId", async (req, res) => {
  try {
    const { painPointId, linkId } = req.params;
    const { percentageSolved, notes } = req.body;

    if (percentageSolved !== null && percentageSolved !== undefined) {
      const percent = Number(percentageSolved);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return res.status(400).json({ message: "Percentage solved must be between 0 and 100" });
      }
    }

    await db
      .update(painPointUseCases)
      .set({
        percentageSolved: percentageSolved !== null && percentageSolved !== undefined ? String(percentageSolved) : null,
        notes: notes || null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(painPointUseCases.id, linkId),
          eq(painPointUseCases.painPointId, painPointId)
        )
      );

    const [updated] = await db
      .select({
        id: painPointUseCases.id,
        painPointId: painPointUseCases.painPointId,
        useCaseId: painPointUseCases.useCaseId,
        percentageSolved: painPointUseCases.percentageSolved,
        notes: painPointUseCases.notes,
        createdAt: painPointUseCases.createdAt,
        useCaseName: useCases.name,
        useCaseComplexity: useCases.complexity,
        useCaseConfidence: useCases.confidenceLevel
      })
      .from(painPointUseCases)
      .leftJoin(useCases, eq(painPointUseCases.useCaseId, useCases.id))
      .where(eq(painPointUseCases.id, linkId));

    res.json({
      ...updated,
      percentageSolved: updated.percentageSolved !== null ? Number(updated.percentageSolved) : null
    });
  } catch (error) {
    console.error("Failed to update pain point link", error);
    res.status(500).json({ message: "Failed to update pain point link" });
  }
});

router.delete("/pain-points/:painPointId/links/:linkId", async (req, res) => {
  try {
    const { painPointId, linkId } = req.params;

    await db
      .delete(painPointUseCases)
      .where(
        and(
          eq(painPointUseCases.id, linkId),
          eq(painPointUseCases.painPointId, painPointId)
        )
      );

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete pain point link", error);
    res.status(500).json({ message: "Failed to delete pain point link" });
  }
});

router.get("/processes/:processId/pain-points", async (req, res) => {
  try {
    const { processId } = req.params;

    const painPointsData = await db
      .select({
        id: painPoints.id,
        statement: painPoints.statement,
        impactType: painPoints.impactType,
        businessImpact: painPoints.businessImpact,
        magnitude: painPoints.magnitude,
        frequency: painPoints.frequency,
        timePerUnit: painPoints.timePerUnit,
        totalHoursPerMonth: painPoints.totalHoursPerMonth,
        fteCount: painPoints.fteCount,
        rootCause: painPoints.rootCause,
        workarounds: painPoints.workarounds,
        dependencies: painPoints.dependencies,
        riskLevel: painPoints.riskLevel,
        effortSolving: painPoints.effortSolving,
        createdAt: painPoints.createdAt
      })
      .from(painPoints);

    const formatted = painPointsData.map((pp) => ({
      ...pp,
      magnitude: pp.magnitude !== null ? Number(pp.magnitude) : null,
      frequency: pp.frequency !== null ? Number(pp.frequency) : null,
      timePerUnit: pp.timePerUnit !== null ? Number(pp.timePerUnit) : null,
      totalHoursPerMonth: pp.totalHoursPerMonth !== null ? Number(pp.totalHoursPerMonth) : null,
      fteCount: pp.fteCount !== null ? Number(pp.fteCount) : null,
      effortSolving: pp.effortSolving !== null ? Number(pp.effortSolving) : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Failed to fetch process pain points", error);
    res.status(500).json({ message: "Failed to fetch process pain points" });
  }
});

export default router;
