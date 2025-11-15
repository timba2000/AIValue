import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { useCases } from "../db/schema";
import { getUseCaseClassifier, parseUseCaseClassificationLabel } from "../../services/useCaseClassifier";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db.select().from(useCases).orderBy(desc(useCases.createdAt));
    res.json(results);
  } catch (error) {
    console.error("Failed to fetch use cases", error);
    res.status(500).json({ message: "Failed to fetch use cases" });
  }
});

router.post("/", async (req, res) => {
  const { title, problem } = req.body ?? {};

  if (!title || !problem) {
    return res.status(400).json({ message: "title and problem are required" });
  }

  let industry: string | undefined;
  let pattern: string | undefined;
  let automationLevel: string | undefined;
  let confidence: number | undefined;

  try {
    const classifier = getUseCaseClassifier();
    const classification = await classifier.classify(problem);
    const parsed = parseUseCaseClassificationLabel(classification.label);

    industry = parsed.industry;
    pattern = parsed.pattern;
    automationLevel = parsed.automationLevel;
    confidence = classification.confidence;
  } catch (error) {
    console.error("Failed to classify use case", error);

    const message = error instanceof Error ? error.message : "Unexpected classification error";

    return res.status(502).json({
      message: "Failed to classify use case description",
      detail: message
    });
  }

  try {
    const [created] = await db
      .insert(useCases)
      .values({
        title,
        problem,
        industry,
        pattern,
        automationLevel,
        classificationConfidence: confidence !== undefined ? confidence.toString() : null
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

export default router;
