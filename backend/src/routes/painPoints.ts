import { Router } from "express";
import { asc, desc, eq, sql, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { painPoints, processPainPoints, processes, businessUnits, taxonomyCategories } from "../db/schema.js";
import { isEditorOrAdmin } from "../simpleAuth.js";

const router = Router();

const parseOptionalNumber = (value: unknown, field: string): number | null => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number`);
  }
  return parsed;
};

router.get("/", async (req, res) => {
  try {
    const { companyId, businessUnitId, processIds } = req.query;

    let results;

    if (companyId || businessUnitId || processIds) {
      const processIdsArray = processIds 
        ? (Array.isArray(processIds) ? processIds : [processIds]).filter((id): id is string => typeof id === 'string')
        : [];

      const businessUnitIds = businessUnitId
        ? (typeof businessUnitId === 'string' 
            ? businessUnitId.split(',').filter(id => id.trim())
            : Array.isArray(businessUnitId) ? businessUnitId.filter((id): id is string => typeof id === 'string') : [])
        : [];

      const painPointsViaProcesses = await (async () => {
        if (processIdsArray.length > 0 || businessUnitIds.length > 0 || companyId) {
          const query = db
            .selectDistinct({
              id: painPoints.id,
              statement: painPoints.statement,
              impactType: painPoints.impactType,
              businessImpact: painPoints.businessImpact,
              magnitude: painPoints.magnitude,
              frequency: painPoints.frequency,
              timePerUnit: painPoints.timePerUnit,
              totalHoursPerMonth: painPoints.totalHoursPerMonth,
              fteCount: painPoints.fteCount,
              rootCause: painPoints.rootCause,
              workarounds: painPoints.workarounds,
              dependencies: painPoints.dependencies,
              riskLevel: painPoints.riskLevel,
              effortSolving: painPoints.effortSolving,
              taxonomyLevel1Id: painPoints.taxonomyLevel1Id,
              taxonomyLevel2Id: painPoints.taxonomyLevel2Id,
              taxonomyLevel3Id: painPoints.taxonomyLevel3Id,
              companyId: painPoints.companyId,
              businessUnitId: painPoints.businessUnitId,
              createdAt: painPoints.createdAt,
              updatedAt: painPoints.updatedAt
            })
            .from(painPoints)
            .innerJoin(processPainPoints, eq(painPoints.id, processPainPoints.painPointId))
            .innerJoin(processes, eq(processPainPoints.processId, processes.id))
            .innerJoin(businessUnits, eq(processes.businessUnitId, businessUnits.id))
            .$dynamic();

          const conditions = [];

          if (companyId && typeof companyId === 'string') {
            conditions.push(eq(businessUnits.companyId, companyId));
          }

          if (businessUnitIds.length === 1) {
            conditions.push(eq(processes.businessUnitId, businessUnitIds[0]));
          } else if (businessUnitIds.length > 1) {
            conditions.push(inArray(processes.businessUnitId, businessUnitIds));
          }

          if (processIdsArray.length > 0) {
            conditions.push(inArray(processes.id, processIdsArray));
          }

          if (conditions.length > 0) {
            return await query.where(sql`${sql.join(conditions, sql` AND `)}`);
          }
          return await query;
        }
        return [];
      })();

      const painPointsViaDirect = await (async () => {
        if (businessUnitIds.length > 0) {
          const query = db
            .select({
              id: painPoints.id,
              statement: painPoints.statement,
              impactType: painPoints.impactType,
              businessImpact: painPoints.businessImpact,
              magnitude: painPoints.magnitude,
              frequency: painPoints.frequency,
              timePerUnit: painPoints.timePerUnit,
              totalHoursPerMonth: painPoints.totalHoursPerMonth,
              fteCount: painPoints.fteCount,
              rootCause: painPoints.rootCause,
              workarounds: painPoints.workarounds,
              dependencies: painPoints.dependencies,
              riskLevel: painPoints.riskLevel,
              effortSolving: painPoints.effortSolving,
              taxonomyLevel1Id: painPoints.taxonomyLevel1Id,
              taxonomyLevel2Id: painPoints.taxonomyLevel2Id,
              taxonomyLevel3Id: painPoints.taxonomyLevel3Id,
              companyId: painPoints.companyId,
              businessUnitId: painPoints.businessUnitId,
              createdAt: painPoints.createdAt,
              updatedAt: painPoints.updatedAt
            })
            .from(painPoints)
            .where(
              businessUnitIds.length === 1
                ? eq(painPoints.businessUnitId, businessUnitIds[0])
                : inArray(painPoints.businessUnitId, businessUnitIds)
            );
          return await query;
        } else if (companyId && typeof companyId === 'string') {
          // Get pain points with direct companyId link
          const directCompanyQuery = db
            .select({
              id: painPoints.id,
              statement: painPoints.statement,
              impactType: painPoints.impactType,
              businessImpact: painPoints.businessImpact,
              magnitude: painPoints.magnitude,
              frequency: painPoints.frequency,
              timePerUnit: painPoints.timePerUnit,
              totalHoursPerMonth: painPoints.totalHoursPerMonth,
              fteCount: painPoints.fteCount,
              rootCause: painPoints.rootCause,
              workarounds: painPoints.workarounds,
              dependencies: painPoints.dependencies,
              riskLevel: painPoints.riskLevel,
              effortSolving: painPoints.effortSolving,
              taxonomyLevel1Id: painPoints.taxonomyLevel1Id,
              taxonomyLevel2Id: painPoints.taxonomyLevel2Id,
              taxonomyLevel3Id: painPoints.taxonomyLevel3Id,
              companyId: painPoints.companyId,
              businessUnitId: painPoints.businessUnitId,
              createdAt: painPoints.createdAt,
              updatedAt: painPoints.updatedAt
            })
            .from(painPoints)
            .where(eq(painPoints.companyId, companyId));
          
          // Also get pain points linked via businessUnit
          const viaBUQuery = db
            .select({
              id: painPoints.id,
              statement: painPoints.statement,
              impactType: painPoints.impactType,
              businessImpact: painPoints.businessImpact,
              magnitude: painPoints.magnitude,
              frequency: painPoints.frequency,
              timePerUnit: painPoints.timePerUnit,
              totalHoursPerMonth: painPoints.totalHoursPerMonth,
              fteCount: painPoints.fteCount,
              rootCause: painPoints.rootCause,
              workarounds: painPoints.workarounds,
              dependencies: painPoints.dependencies,
              riskLevel: painPoints.riskLevel,
              effortSolving: painPoints.effortSolving,
              taxonomyLevel1Id: painPoints.taxonomyLevel1Id,
              taxonomyLevel2Id: painPoints.taxonomyLevel2Id,
              taxonomyLevel3Id: painPoints.taxonomyLevel3Id,
              companyId: painPoints.companyId,
              businessUnitId: painPoints.businessUnitId,
              createdAt: painPoints.createdAt,
              updatedAt: painPoints.updatedAt
            })
            .from(painPoints)
            .innerJoin(businessUnits, eq(painPoints.businessUnitId, businessUnits.id))
            .where(eq(businessUnits.companyId, companyId));
          
          const [directResults, viaBUResults] = await Promise.all([directCompanyQuery, viaBUQuery]);
          return [...directResults, ...viaBUResults];
        }
        return [];
      })();

      const allPainPoints = [...painPointsViaProcesses, ...painPointsViaDirect];
      const uniqueMap = new Map<string, typeof allPainPoints[0]>();
      for (const pp of allPainPoints) {
        if (!uniqueMap.has(pp.id)) {
          uniqueMap.set(pp.id, pp);
        }
      }
      results = Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      results = await db
        .select()
        .from(painPoints)
        .orderBy(desc(painPoints.createdAt));
    }

    const painPointIds = results.map((pp) => pp.id);
    const processLinks = painPointIds.length > 0
      ? await db
          .select({
            painPointId: processPainPoints.painPointId,
            processId: processPainPoints.processId
          })
          .from(processPainPoints)
          .where(inArray(processPainPoints.painPointId, painPointIds))
      : [];

    const processLinkMap = processLinks.reduce((acc, link) => {
      if (!acc[link.painPointId]) {
        acc[link.painPointId] = [];
      }
      acc[link.painPointId].push(link.processId);
      return acc;
    }, {} as Record<string, string[]>);

    const resultsWithProcessIds = results.map((pp) => ({
      ...pp,
      processIds: processLinkMap[pp.id] || []
    }));

    res.json(resultsWithProcessIds);
  } catch {
    
    res.status(500).json({ message: "Failed to fetch pain points" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await db
      .select()
      .from(painPoints)
      .where(eq(painPoints.id, id));
    
    if (!result) {
      return res.status(404).json({ message: "Pain point not found" });
    }
    
    const processLinks = await db
      .select({ processId: processPainPoints.processId })
      .from(processPainPoints)
      .where(eq(processPainPoints.painPointId, id));
    
    res.json({
      ...result,
      processIds: processLinks.map(link => link.processId)
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch pain point" });
  }
});

router.post("/", isEditorOrAdmin, async (req, res) => {
  const {
    statement,
    impactType,
    businessImpact,
    magnitude,
    frequency,
    timePerUnit,
    fteCount,
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    effortSolving,
    processIds,
    taxonomyLevel1Id,
    taxonomyLevel2Id,
    taxonomyLevel3Id,
    companyId,
    businessUnitId
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let effortNum: number | null = null;
  let timePerUnitNum: number | null = null;
  let fteCountNum: number | null = null;
  let totalHoursPerMonth: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    effortNum = parseOptionalNumber(effortSolving, "effortSolving");
    timePerUnitNum = parseOptionalNumber(timePerUnit, "timePerUnit");
    fteCountNum = parseOptionalNumber(fteCount, "fteCount");
    
    if (frequencyNum != null && timePerUnitNum != null) {
      totalHoursPerMonth = frequencyNum * timePerUnitNum;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  const impactTypeArray = Array.isArray(impactType) ? impactType.filter(Boolean) : (impactType ? [impactType] : null);

  try {
    const processIdsArray = Array.isArray(processIds) ? processIds.filter(Boolean) : [];
    
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(painPoints)
        .values({
          statement: statementText,
          impactType: impactTypeArray && impactTypeArray.length > 0 ? impactTypeArray : null,
          businessImpact: businessImpact || null,
          magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
          frequency: frequencyNum != null ? String(frequencyNum) : null,
          timePerUnit: timePerUnitNum != null ? String(timePerUnitNum) : null,
          totalHoursPerMonth: totalHoursPerMonth != null ? String(totalHoursPerMonth) : null,
          fteCount: fteCountNum != null ? String(fteCountNum) : null,
          rootCause: rootCause || null,
          workarounds: workarounds || null,
          dependencies: dependencies || null,
          riskLevel: riskLevel || null,
          effortSolving: effortNum != null ? String(effortNum) : null,
          taxonomyLevel1Id: taxonomyLevel1Id || null,
          taxonomyLevel2Id: taxonomyLevel2Id || null,
          taxonomyLevel3Id: taxonomyLevel3Id || null,
          companyId: companyId || null,
          businessUnitId: businessUnitId || null
        })
        .returning();

      if (processIdsArray.length > 0) {
        const uniqueProcessIds = Array.from(new Set(processIdsArray));
        await tx.insert(processPainPoints).values(
          uniqueProcessIds.map((processId) => ({ painPointId: created.id, processId }))
        );
      }

      return created;
    });

    res.status(201).json({ ...result, processIds: processIdsArray });
  } catch {
    
    res.status(500).json({ message: "Failed to create pain point" });
  }
});

router.put("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    statement,
    impactType,
    businessImpact,
    magnitude,
    frequency,
    timePerUnit,
    fteCount,
    rootCause,
    workarounds,
    dependencies,
    riskLevel,
    effortSolving,
    processIds,
    taxonomyLevel1Id,
    taxonomyLevel2Id,
    taxonomyLevel3Id,
    companyId,
    businessUnitId
  } = req.body ?? {};

  const statementText = (statement ?? "").trim();

  if (!statementText) {
    return res.status(400).json({ message: "statement is required" });
  }

  let magnitudeNum: number | null = null;
  let frequencyNum: number | null = null;
  let effortNum: number | null = null;
  let timePerUnitNum: number | null = null;
  let fteCountNum: number | null = null;
  let totalHoursPerMonth: number | null = null;

  try {
    magnitudeNum = parseOptionalNumber(magnitude, "magnitude");
    frequencyNum = parseOptionalNumber(frequency, "frequency");
    effortNum = parseOptionalNumber(effortSolving, "effortSolving");
    timePerUnitNum = parseOptionalNumber(timePerUnit, "timePerUnit");
    fteCountNum = parseOptionalNumber(fteCount, "fteCount");
    
    if (frequencyNum != null && timePerUnitNum != null) {
      totalHoursPerMonth = frequencyNum * timePerUnitNum;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid numeric value";
    return res.status(400).json({ message });
  }

  const impactTypeArray = Array.isArray(impactType) ? impactType.filter(Boolean) : (impactType ? [impactType] : null);

  try {
    const [existing] = await db.select().from(painPoints).where(eq(painPoints.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Pain point not found" });
    }

    const processIdsArray = Array.isArray(processIds) ? processIds.filter(Boolean) : [];

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(painPoints)
        .set({
          statement: statementText,
          impactType: impactTypeArray && impactTypeArray.length > 0 ? impactTypeArray : null,
          businessImpact: businessImpact || null,
          magnitude: magnitudeNum != null ? String(magnitudeNum) : null,
          frequency: frequencyNum != null ? String(frequencyNum) : null,
          timePerUnit: timePerUnitNum != null ? String(timePerUnitNum) : null,
          totalHoursPerMonth: totalHoursPerMonth != null ? String(totalHoursPerMonth) : null,
          fteCount: fteCountNum != null ? String(fteCountNum) : null,
          rootCause: rootCause || null,
          workarounds: workarounds || null,
          dependencies: dependencies || null,
          riskLevel: riskLevel || null,
          effortSolving: effortNum != null ? String(effortNum) : null,
          taxonomyLevel1Id: taxonomyLevel1Id || null,
          taxonomyLevel2Id: taxonomyLevel2Id || null,
          taxonomyLevel3Id: taxonomyLevel3Id || null,
          companyId: companyId || null,
          businessUnitId: businessUnitId || null
        })
        .where(eq(painPoints.id, id))
        .returning();

      await tx.delete(processPainPoints).where(eq(processPainPoints.painPointId, id));

      if (processIdsArray.length > 0) {
        const uniqueProcessIds = Array.from(new Set(processIdsArray));
        await tx.insert(processPainPoints).values(
          uniqueProcessIds.map((processId) => ({ painPointId: id, processId }))
        );
      }

      return updated;
    });

    res.json({ ...result, processIds: processIdsArray });
  } catch {
    
    res.status(500).json({ message: "Failed to update pain point" });
  }
});

router.delete("/:id", isEditorOrAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.select().from(painPoints).where(eq(painPoints.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Pain point not found" });
    }

    await db.delete(painPoints).where(eq(painPoints.id, id));
    res.status(204).send();
  } catch {
    
    res.status(500).json({ message: "Failed to delete pain point" });
  }
});

export default router;
