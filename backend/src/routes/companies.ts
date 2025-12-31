import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { businessUnits, companies } from "../db/schema.js";
import { isEditorOrAdmin } from "../simpleAuth.js";
import { logCreate, logUpdate, logDelete, getAuditContext } from "../services/auditLog.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const results = await db.select().from(companies).orderBy(desc(companies.createdAt));
    res.json(results);
  } catch {
    res.status(500).json({ message: "Failed to fetch companies" });
  }
});

router.post("/", isEditorOrAdmin, async (req, res) => {
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

    await logCreate("company", created.id, created.name, created as Record<string, unknown>, await getAuditContext(req as any));

    res.status(201).json(created);
  } catch {
    res.status(500).json({ message: "Failed to create company" });
  }
});

router.put("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, industry, anzsic } = req.body ?? {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return res.status(400).json({ message: "Company name must not be empty" });
  }

  try {
    const [existing] = await db.select().from(companies).where(eq(companies.id, id));
    
    if (!existing) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [updated] = await db
      .update(companies)
      .set({ name: trimmedName, industry, anzsic })
      .where(eq(companies.id, id))
      .returning();

    await logUpdate("company", id, updated.name, existing as Record<string, unknown>, updated as Record<string, unknown>, await getAuditContext(req as any));

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update company" });
  }
});

router.delete("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(companies).where(eq(companies.id, id));
    
    if (!existing) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [deleted] = await db.delete(companies).where(eq(companies.id, id)).returning();

    await logDelete("company", id, existing.name, existing as Record<string, unknown>, await getAuditContext(req as any));

    res.json({ message: "Company deleted" });
  } catch {
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
  } catch {
    res.status(500).json({ message: "Failed to fetch business units" });
  }
});

export default router;
