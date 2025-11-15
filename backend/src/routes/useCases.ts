import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { useCases } from "../db/schema";
import { getUseCaseClassifier, parseUseCaseClassificationLabel } from "../../services/useCaseClassifier";

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
    title,
    problem,
    hoursSavedPerOccurrence: rawHoursSaved,
    occurrencesPerMonth: rawOccurrences,
    valuePerHour: rawValuePerHour
  } = req.body ?? {};

  if (!title || !problem) {
    return res.status(400).json({ message: "title and problem are required" });
  }

  const parseMetric = (value: unknown, field: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${field} must be a non-negative number`);
    }
    return parsed;
  };

  let hoursSaved: number;
  let occurrences: number;
  let valuePerHour: number;

  try {
    hoursSaved = parseMetric(rawHoursSaved, "hoursSavedPerOccurrence");
    occurrences = parseMetric(rawOccurrences, "occurrencesPerMonth");
    valuePerHour = parseMetric(rawValuePerHour, "valuePerHour");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid metric value";
    return res.status(400).json({ message });
  }

  let industry: string | undefined;
  let pattern: string | undefined;
  let automationLevel: string | undefined;
  let confidence: number | undefined;

  const valueScore = hoursSaved * occurrences * valuePerHour;

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
        classificationConfidence: confidence !== undefined ? confidence.toString() : null,
        hoursSavedPerOccurrence: hoursSaved.toString(),
        occurrencesPerMonth: occurrences.toString(),
        valuePerHour: valuePerHour.toString(),
        valueScore: valueScore.toString()
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

export default router;
