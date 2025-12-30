import { Router } from "express";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { businessUnits, companies, processes } from "../db/schema.js";
import { isEditorOrAdmin } from "../simpleAuth.js";

const router = Router();

const MAX_DEPTH = 3;

const parseFte = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("FTE must be a non-negative number");
  }
  return Math.floor(parsed);
};

async function getUnitDepth(unitId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = unitId;
  
  while (currentId) {
    const [unit] = await db
      .select({ parentId: businessUnits.parentId })
      .from(businessUnits)
      .where(eq(businessUnits.id, currentId));
    
    if (!unit || !unit.parentId) break;
    depth++;
    currentId = unit.parentId;
  }
  
  return depth;
}

async function getMaxDescendantDepth(unitId: string): Promise<number> {
  const children = await db
    .select({ id: businessUnits.id })
    .from(businessUnits)
    .where(eq(businessUnits.parentId, unitId));
  
  if (children.length === 0) return 0;
  
  let maxChildDepth = 0;
  for (const child of children) {
    const childDepth = await getMaxDescendantDepth(child.id);
    maxChildDepth = Math.max(maxChildDepth, childDepth + 1);
  }
  
  return maxChildDepth;
}

async function isDescendant(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
  let currentId: string | null = potentialDescendantId;
  
  while (currentId) {
    if (currentId === ancestorId) return true;
    
    const [unit] = await db
      .select({ parentId: businessUnits.parentId })
      .from(businessUnits)
      .where(eq(businessUnits.id, currentId));
    
    if (!unit) break;
    currentId = unit.parentId;
  }
  
  return false;
}

async function hasChildren(unitId: string): Promise<boolean> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(businessUnits)
    .where(eq(businessUnits.parentId, unitId));
  
  return Number(count) > 0;
}

async function getAllDescendantIds(unitId: string): Promise<string[]> {
  const descendants: string[] = [];
  const directChildren = await db
    .select({ id: businessUnits.id })
    .from(businessUnits)
    .where(eq(businessUnits.parentId, unitId));
  
  for (const child of directChildren) {
    descendants.push(child.id);
    const childDescendants = await getAllDescendantIds(child.id);
    descendants.push(...childDescendants);
  }
  
  return descendants;
}

async function getChildrenFteSum(parentId: string, excludeUnitId?: string): Promise<number> {
  const children = await db
    .select({ id: businessUnits.id, fte: businessUnits.fte })
    .from(businessUnits)
    .where(eq(businessUnits.parentId, parentId));
  
  return children
    .filter(child => child.id !== excludeUnitId)
    .reduce((sum, child) => sum + child.fte, 0);
}

async function getTotalDescendantFte(unitId: string): Promise<number> {
  const directChildren = await db
    .select({ id: businessUnits.id, fte: businessUnits.fte })
    .from(businessUnits)
    .where(eq(businessUnits.parentId, unitId));
  
  let total = 0;
  for (const child of directChildren) {
    total += child.fte;
    total += await getTotalDescendantFte(child.id);
  }
  
  return total;
}

interface BusinessUnitWithChildren {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  fte: number;
  createdAt: Date;
  updatedAt: Date;
  children: BusinessUnitWithChildren[];
  depth: number;
}

function buildTree(
  units: Array<{
    id: string;
    companyId: string;
    parentId: string | null;
    name: string;
    description: string | null;
    fte: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
  parentId: string | null = null,
  depth: number = 1
): BusinessUnitWithChildren[] {
  return units
    .filter(unit => unit.parentId === parentId)
    .map(unit => ({
      ...unit,
      depth,
      children: buildTree(units, unit.id, depth + 1)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

router.get("/", async (_req, res) => {
  try {
    const allBusinessUnits = await db
      .select()
      .from(businessUnits)
      .orderBy(desc(businessUnits.createdAt));
    
    res.json(allBusinessUnits);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch business units" });
  }
});

router.get("/tree", async (req, res) => {
  try {
    const { companyId } = req.query;
    
    let query = db.select().from(businessUnits);
    
    if (companyId && typeof companyId === "string") {
      query = query.where(eq(businessUnits.companyId, companyId)) as typeof query;
    }
    
    const allUnits = await query;
    const tree = buildTree(allUnits);
    
    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch business units tree" });
  }
});

router.get("/flat", async (req, res) => {
  try {
    const { companyId } = req.query;
    
    const allUnits = companyId && typeof companyId === "string"
      ? await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId))
      : await db.select().from(businessUnits);
    
    const tree = buildTree(allUnits);
    
    const flattenTree = (nodes: BusinessUnitWithChildren[], result: BusinessUnitWithChildren[] = []): BusinessUnitWithChildren[] => {
      for (const node of nodes) {
        result.push(node);
        if (node.children.length > 0) {
          flattenTree(node.children, result);
        }
      }
      return result;
    };
    
    const flatList = flattenTree(tree);
    res.json(flatList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch business units" });
  }
});

router.post("/", isEditorOrAdmin, async (req, res) => {
  const { companyId, name, fte, description, parentId } = req.body ?? {};
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

    if (parentId) {
      const [parent] = await db.select().from(businessUnits).where(eq(businessUnits.id, parentId));
      if (!parent) {
        return res.status(400).json({ message: "Parent business unit not found" });
      }
      if (parent.companyId !== companyId) {
        return res.status(400).json({ message: "Parent must belong to the same company" });
      }
      
      const parentDepth = await getUnitDepth(parentId);
      if (parentDepth >= MAX_DEPTH) {
        return res.status(400).json({ 
          message: `Maximum hierarchy depth of ${MAX_DEPTH} levels exceeded. Cannot add child to a unit at depth ${parentDepth}.` 
        });
      }

      const currentChildrenFte = await getChildrenFteSum(parentId);
      if (currentChildrenFte + fteValue > parent.fte) {
        const remainingFte = parent.fte - currentChildrenFte;
        return res.status(400).json({ 
          message: `FTE exceeds parent capacity. Parent "${parent.name}" has ${parent.fte} FTE, children already use ${currentChildrenFte} FTE. Maximum allowed for this unit: ${remainingFte} FTE.` 
        });
      }
    }

    const [created] = await db
      .insert(businessUnits)
      .values({ 
        companyId, 
        name: trimmedName, 
        fte: fteValue, 
        description,
        parentId: parentId || null
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create business unit";
    res.status(400).json({ message });
  }
});

router.put("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, fte, description, parentId } = req.body ?? {};
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
    const [existingUnit] = await db.select().from(businessUnits).where(eq(businessUnits.id, id));
    if (!existingUnit) {
      return res.status(404).json({ message: "Business unit not found" });
    }

    const newParentId = parentId === undefined ? existingUnit.parentId : (parentId || null);

    // Check if reducing FTE would violate children constraint
    const childrenFte = await getChildrenFteSum(id);
    if (fteValue < childrenFte) {
      return res.status(400).json({ 
        message: `Cannot reduce FTE below ${childrenFte}. Child units currently use ${childrenFte} FTE total.` 
      });
    }

    if (newParentId && newParentId !== existingUnit.parentId) {
      // Changing to a new parent
      if (newParentId === id) {
        return res.status(400).json({ message: "A unit cannot be its own parent" });
      }

      const [parent] = await db.select().from(businessUnits).where(eq(businessUnits.id, newParentId));
      if (!parent) {
        return res.status(400).json({ message: "Parent business unit not found" });
      }
      if (parent.companyId !== existingUnit.companyId) {
        return res.status(400).json({ message: "Parent must belong to the same company" });
      }

      const wouldCreateCycle = await isDescendant(newParentId, id);
      if (wouldCreateCycle) {
        return res.status(400).json({ message: "Cannot set parent: would create a circular reference" });
      }

      const parentDepth = await getUnitDepth(newParentId);
      const descendantDepth = await getMaxDescendantDepth(id);
      const totalDepth = parentDepth + 1 + descendantDepth;
      
      if (totalDepth > MAX_DEPTH) {
        return res.status(400).json({ 
          message: `Moving this unit would exceed the maximum hierarchy depth of ${MAX_DEPTH} levels.` 
        });
      }

      // Check FTE constraint with new parent
      const newParentChildrenFte = await getChildrenFteSum(newParentId);
      if (newParentChildrenFte + fteValue > parent.fte) {
        const remainingFte = parent.fte - newParentChildrenFte;
        return res.status(400).json({ 
          message: `FTE exceeds new parent capacity. Parent "${parent.name}" has ${parent.fte} FTE, children already use ${newParentChildrenFte} FTE. Maximum allowed: ${remainingFte} FTE.` 
        });
      }
    } else if (newParentId && fteValue !== existingUnit.fte) {
      // Same parent but FTE changed - check if still within parent's capacity
      const [parent] = await db.select().from(businessUnits).where(eq(businessUnits.id, newParentId));
      if (parent) {
        const siblingsAndSelfFte = await getChildrenFteSum(newParentId, id);
        if (siblingsAndSelfFte + fteValue > parent.fte) {
          const remainingFte = parent.fte - siblingsAndSelfFte;
          return res.status(400).json({ 
            message: `FTE exceeds parent capacity. Parent "${parent.name}" has ${parent.fte} FTE, siblings use ${siblingsAndSelfFte} FTE. Maximum allowed for this unit: ${remainingFte} FTE.` 
          });
        }
      }
    }

    const [updated] = await db
      .update(businessUnits)
      .set({ 
        name: trimmedName, 
        fte: fteValue, 
        description,
        parentId: newParentId
      })
      .where(eq(businessUnits.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update business unit" });
  }
});

router.delete("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const unitHasChildren = await hasChildren(id);
    if (unitHasChildren) {
      return res.status(400).json({
        message: "This business unit has child units. Delete or reassign them before proceeding."
      });
    }

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
    res.status(500).json({ message: "Failed to delete business unit" });
  }
});

export default router;
