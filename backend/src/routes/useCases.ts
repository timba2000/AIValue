import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { useCases } from "../db/schema";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db
      .select()
      .from(useCases)
      .orderBy(desc(useCases.valueScore), desc(useCases.createdAt));
    res.json(results);
  } catch (error) {
    console.error("Failed to fetch use cases", error);
    res.status(500).json({ message: "Failed to fetch use cases" });
  }
});

router.post("/", async (req, res) => {
  const {
    name,
    summary,
    valueScore: rawValueScore,
    effortScore: rawEffortScore,
    riskScore: rawRiskScore,
    complexityScore: rawComplexityScore,
    category,
    maturity,
    prerequisites
  } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  const parseOptionalMetric = (value: unknown, field: string): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${field} must be a non-negative number`);
    }
    return parsed;
  };

  let valueScore: number | undefined;
  let effortScore: number | undefined;
  let riskScore: number | undefined;
  let complexityScore: number | undefined;

  try {
    valueScore = parseOptionalMetric(rawValueScore, "valueScore");
    effortScore = parseOptionalMetric(rawEffortScore, "effortScore");
    riskScore = parseOptionalMetric(rawRiskScore, "riskScore");
    complexityScore = parseOptionalMetric(rawComplexityScore, "complexityScore");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid metric value";
    return res.status(400).json({ message });
  }

  try {
    const [created] = await db
      .insert(useCases)
      .values({
        name,
        summary,
        valueScore: (valueScore ?? 0).toString(),
        effortScore: (effortScore ?? 0).toString(),
        riskScore: (riskScore ?? 0).toString(),
        complexityScore: (complexityScore ?? 0).toString(),
        category,
        maturity,
        prerequisites
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

export default router;
