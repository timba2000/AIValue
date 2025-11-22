import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { businessUnits, companies, processes } from "../db/schema";

const router = Router();

const parseFte = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("FTE must be a non-negative number");
  }
  return Math.floor(parsed);
};

router.post("/", async (req, res) => {
  const { companyId, name, fte, description } = req.body ?? {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return res.status(400).json({ message: "Business unit name must not be empty" });
  }

  try {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) {
      return res.status(400).json({ message: "Invalid companyId" });
    }

    const fteValue = parseFte(fte);

    const [created] = await db
      .insert(businessUnits)
      .values({ companyId, name: trimmedName, fte: fteValue, description })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create business unit";
    console.error("Failed to create business unit", error);
    res.status(400).json({ message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, fte, description } = req.body ?? {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return res.status(400).json({ message: "Business unit name must not be empty" });
  }

  let fteValue: number;
  try {
    fteValue = parseFte(fte);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid FTE";
    return res.status(400).json({ message });
  }

  try {
    const [updated] = await db
      .update(businessUnits)
      .set({ name: trimmedName, fte: fteValue, description })
      .where(eq(businessUnits.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Business unit not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Failed to update business unit", error);
    res.status(500).json({ message: "Failed to update business unit" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(processes)
      .where(eq(processes.businessUnitId, id));

    if (Number(count) > 0) {
      return res.status(400).json({
        message: "This business unit has related processes. Delete or reassign them before proceeding."
      });
    }

    const [deleted] = await db.delete(businessUnits).where(eq(businessUnits.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ message: "Business unit not found" });
    }

    res.json({ message: "Business unit deleted" });
  } catch (error) {
    console.error("Failed to delete business unit", error);
    res.status(500).json({ message: "Failed to delete business unit" });
  }
});

export default router;
