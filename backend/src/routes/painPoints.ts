import { Router } from "express";
import { asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { painPoints } from "../db/schema.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db
      .select({ id: painPoints.id, statement: painPoints.statement })
      .from(painPoints)
      .orderBy(asc(painPoints.statement));

    res.json(results);
  } catch (error) {
    console.error("Failed to fetch pain points", error);
    res.status(500).json({ message: "Failed to fetch pain points" });
  }
});

export default router;
