import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { painPoints } from "../db/schema.js";

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

    res.json(results);
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
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    opportunityPotential
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let opportunityNum: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    opportunityNum = parseOptionalNumber(opportunityPotential, "opportunityPotential");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  try {
    const [created] = await db
      .insert(painPoints)
      .values({
        statement: statementText,
        impactType: impactType || null,
        businessImpact: businessImpact || null,
        magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
        frequency: frequencyNum != null ? String(frequencyNum) : null,
        rootCause: rootCause || null,
        workarounds: workarounds || null,
        dependencies: dependencies || null,
        riskLevel: riskLevel || null,
        opportunityPotential: opportunityNum != null ? String(opportunityNum) : null
      })
      .returning();

    res.status(201).json(created);
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
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    opportunityPotential
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let opportunityNum: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    opportunityNum = parseOptionalNumber(opportunityPotential, "opportunityPotential");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  try {
    const [existing] = await db.select().from(painPoints).where(eq(painPoints.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Pain point not found" });
    }

    const [updated] = await db
      .update(painPoints)
      .set({
        statement: statementText,
        impactType: impactType || null,
        businessImpact: businessImpact || null,
        magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
        frequency: frequencyNum != null ? String(frequencyNum) : null,
        rootCause: rootCause || null,
        workarounds: workarounds || null,
        dependencies: dependencies || null,
        riskLevel: riskLevel || null,
        opportunityPotential: opportunityNum != null ? String(opportunityNum) : null
      })
      .where(eq(painPoints.id, id))
      .returning();

    res.json(updated);
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
