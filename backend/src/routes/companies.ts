import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { businessUnits, companies } from "../db/schema.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db.select().from(companies).orderBy(desc(companies.createdAt));
    res.json(results);
  } catch (error) {
    console.error("Failed to fetch companies", error);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
});

router.post("/", async (req, res) => {
  const { name, industry, anzsic } = req.body ?? {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return res.status(400).json({ message: "Company name must not be empty" });
  }

  try {
    const [created] = await db
      .insert(companies)
      .values({ name: trimmedName, industry, anzsic })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create company", error);
    res.status(500).json({ message: "Failed to create company" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, industry, anzsic } = req.body ?? {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return res.status(400).json({ message: "Company name must not be empty" });
  }

  try {
    const [updated] = await db
      .update(companies)
      .set({ name: trimmedName, industry, anzsic })
      .where(eq(companies.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Failed to update company", error);
    res.status(500).json({ message: "Failed to update company" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [deleted] = await db.delete(companies).where(eq(companies.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ message: "Company deleted" });
  } catch (error) {
    console.error("Failed to delete company", error);
    res.status(500).json({ message: "Failed to delete company" });
  }
});

router.get("/:id/business-units", async (req, res) => {
  const { id } = req.params;

  try {
    const units = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.companyId, id))
      .orderBy(desc(businessUnits.createdAt));

    res.json(units);
  } catch (error) {
    console.error("Failed to fetch business units", error);
    res.status(500).json({ message: "Failed to fetch business units" });
  }
});

export default router;
