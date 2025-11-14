import { Router } from "express";
import { db } from "../db/client";
import { useCases } from "../db/schema";
import { desc } from "drizzle-orm";

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

  try {
    const [created] = await db
      .insert(useCases)
      .values({ title, problem })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create use case", error);
    res.status(500).json({ message: "Failed to create use case" });
  }
});

export default router;
