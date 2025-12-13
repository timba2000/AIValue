import { Router } from "express";
import { db } from "../db/client.js";
import { taxonomyCategories } from "../db/schema.js";
import { eq, isNull, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(taxonomyCategories)
      .orderBy(asc(taxonomyCategories.level), asc(taxonomyCategories.name));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch taxonomy categories" });
  }
});

router.get("/tree", async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(taxonomyCategories)
      .orderBy(asc(taxonomyCategories.level), asc(taxonomyCategories.name));

    const level1 = categories.filter(c => c.level === 1);
    const level2 = categories.filter(c => c.level === 2);
    const level3 = categories.filter(c => c.level === 3);

    const tree = level1.map(l1 => ({
      ...l1,
      children: level2
        .filter(l2 => l2.parentId === l1.id)
        .map(l2 => ({
          ...l2,
          children: level3.filter(l3 => l3.parentId === l2.id)
        }))
    }));

    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch taxonomy tree" });
  }
});

router.get("/level/:level", async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    if (isNaN(level) || level < 1 || level > 3) {
      return res.status(400).json({ message: "Level must be 1, 2, or 3" });
    }

    const categories = await db
      .select()
      .from(taxonomyCategories)
      .where(eq(taxonomyCategories.level, level))
      .orderBy(asc(taxonomyCategories.name));

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch taxonomy categories" });
  }
});

router.get("/children/:parentId", async (req, res) => {
  try {
    const { parentId } = req.params;
    const categories = await db
      .select()
      .from(taxonomyCategories)
      .where(eq(taxonomyCategories.parentId, parentId))
      .orderBy(asc(taxonomyCategories.name));

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch child categories" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, parentId, level } = req.body;

    if (!name || typeof level !== "number") {
      return res.status(400).json({ message: "Name and level are required" });
    }

    if (level < 1 || level > 3) {
      return res.status(400).json({ message: "Level must be 1, 2, or 3" });
    }

    if (level === 1 && parentId) {
      return res.status(400).json({ message: "Level 1 categories cannot have a parent" });
    }

    if (level > 1 && !parentId) {
      return res.status(400).json({ message: "Level 2 and 3 categories must have a parent" });
    }

    if (parentId) {
      const [parent] = await db
        .select()
        .from(taxonomyCategories)
        .where(eq(taxonomyCategories.id, parentId));

      if (!parent) {
        return res.status(400).json({ message: "Parent category not found" });
      }

      if (parent.level !== level - 1) {
        return res.status(400).json({ message: "Parent must be one level above" });
      }
    }

    const [category] = await db
      .insert(taxonomyCategories)
      .values({ name, parentId: parentId || null, level })
      .returning();

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to create taxonomy category" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const [category] = await db
      .update(taxonomyCategories)
      .set({ name, updatedAt: new Date() })
      .where(eq(taxonomyCategories.id, id))
      .returning();

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to update taxonomy category" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const children = await db
      .select()
      .from(taxonomyCategories)
      .where(eq(taxonomyCategories.parentId, id));

    if (children.length > 0) {
      return res.status(400).json({ message: "Cannot delete category with children" });
    }

    const [deleted] = await db
      .delete(taxonomyCategories)
      .where(eq(taxonomyCategories.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete taxonomy category" });
  }
});

export default router;
