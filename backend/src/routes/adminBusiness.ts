import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db/client.js";
import { companies, businessUnits, processes, painPoints, useCases } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

router.get("/companies/:companyId/structure/download", async (req, res): Promise<void> => {
  try {
    const { companyId } = req.params;
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const buList = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));
    const buIds = buList.map(bu => bu.id);
    
    let processList: typeof processes.$inferSelect[] = [];
    if (buIds.length > 0) {
      const byCompany = await db.select().from(processes).where(eq(processes.businessId, companyId));
      const byBu = await db.select().from(processes).where(inArray(processes.businessUnitId, buIds));
      const processMap = new Map<string, typeof processes.$inferSelect>();
      byCompany.forEach(p => processMap.set(p.id, p));
      byBu.forEach(p => processMap.set(p.id, p));
      processList = Array.from(processMap.values());
    } else {
      processList = await db.select().from(processes).where(eq(processes.businessId, companyId));
    }

    const buMap = new Map(buList.map(bu => [bu.id, bu]));

    function getBuHierarchy(buId: string | null): { l1: string, l2: string, l3: string } {
      if (!buId) return { l1: "", l2: "", l3: "" };
      
      const bu = buMap.get(buId);
      if (!bu) return { l1: "", l2: "", l3: "" };
      
      const hierarchy: string[] = [];
      let current: typeof bu | undefined = bu;
      let depth = 0;
      while (current && depth < 10) {
        hierarchy.unshift(current.name);
        current = current.parentId ? buMap.get(current.parentId) : undefined;
        depth++;
      }
      
      return {
        l1: hierarchy[0] || "",
        l2: hierarchy[1] || "",
        l3: hierarchy[2] || ""
      };
    }

    const structureData = processList.map(proc => {
      const hierarchy = getBuHierarchy(proc.businessUnitId);
      return {
        "Business Unit L1": hierarchy.l1,
        "Business Unit L2": hierarchy.l2,
        "Business Unit L3": hierarchy.l3,
        "Process Name": proc.name,
        "Description": proc.description || "",
        "Volume": proc.volume || "",
        "Volume Unit": proc.volumeUnit || "",
        "FTE": proc.fte || "",
        "Owner": proc.owner || "",
        "Systems Used": proc.systemsUsed || ""
      };
    });

    const buData = buList.map(bu => {
      const parentBu = bu.parentId ? buMap.get(bu.parentId) : null;
      const grandparentBu = parentBu?.parentId ? buMap.get(parentBu.parentId) : null;
      const level = grandparentBu ? "L3" : (parentBu ? "L2" : "L1");
      
      return {
        "Level": level,
        "Business Unit Name": bu.name,
        "Parent": parentBu?.name || "",
        "Description": bu.description || "",
        "FTE": bu.fte || 0
      };
    });

    const workbook = XLSX.utils.book_new();
    
    if (structureData.length > 0) {
      const processSheet = XLSX.utils.json_to_sheet(structureData);
      XLSX.utils.book_append_sheet(workbook, processSheet, "Processes");
    }
    
    if (buData.length > 0) {
      const buSheet = XLSX.utils.json_to_sheet(buData);
      XLSX.utils.book_append_sheet(workbook, buSheet, "Business Units");
    }

    if (structureData.length === 0 && buData.length === 0) {
      const emptySheet = XLSX.utils.json_to_sheet([{ Message: "No data found for this company" }]);
      XLSX.utils.book_append_sheet(workbook, emptySheet, "Info");
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    const safeCompanyName = company.name.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeCompanyName}_structure.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Error downloading company structure:", error);
    res.status(500).json({ message: "Failed to download company structure" });
  }
});

router.get("/companies/:companyId/insights", async (req, res): Promise<void> => {
  try {
    const { companyId } = req.params;
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const buList = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));
    const processList = await db.select().from(processes).where(eq(processes.businessId, companyId));
    const ppList = await db.select().from(painPoints).where(eq(painPoints.companyId, companyId));

    const processIds = processList.map(p => p.id);
    const solutionList = processIds.length > 0
      ? await db.select().from(useCases).where(inArray(useCases.processId, processIds))
      : [];

    const totalFTE = buList.reduce((sum, bu) => sum + (bu.fte || 0), 0);
    
    let totalProcessFTE = 0;
    processList.forEach(p => {
      const fteVal = parseFloat(String(p.fte || "0"));
      if (!isNaN(fteVal)) totalProcessFTE += fteVal;
    });

    let totalHoursWasted = 0;
    ppList.forEach(pp => {
      const hoursVal = parseFloat(String(pp.totalHoursPerMonth || "0"));
      if (!isNaN(hoursVal)) totalHoursWasted += hoursVal * 12;
    });

    const riskLevelCounts = {
      High: ppList.filter(pp => pp.riskLevel === "High").length,
      Medium: ppList.filter(pp => pp.riskLevel === "Medium").length,
      Low: ppList.filter(pp => pp.riskLevel === "Low").length
    };
    
    const severityBreakdown = [
      { name: "High Risk", value: riskLevelCounts.High, color: "#ef4444" },
      { name: "Medium Risk", value: riskLevelCounts.Medium, color: "#eab308" },
      { name: "Low Risk", value: riskLevelCounts.Low, color: "#22c55e" }
    ].filter(item => item.value > 0);

    const buMap = new Map(buList.map(bu => [bu.id, bu]));
    
    const buBreakdown = buList
      .filter(bu => !bu.parentId)
      .map(bu => {
        const childBus = buList.filter(child => child.parentId === bu.id);
        const grandchildBus = childBus.flatMap(c => buList.filter(gc => gc.parentId === c.id));
        const allBuIds = [bu.id, ...childBus.map(c => c.id), ...grandchildBus.map(gc => gc.id)];
        
        const buProcessCount = processList.filter(p => p.businessUnitId && allBuIds.includes(p.businessUnitId)).length;
        const buPainPointCount = ppList.filter(pp => pp.businessUnitId && allBuIds.includes(pp.businessUnitId)).length;
        
        return {
          name: bu.name,
          processes: buProcessCount,
          painPoints: buPainPointCount,
          fte: bu.fte || 0
        };
      })
      .filter(item => item.processes > 0 || item.painPoints > 0 || item.fte > 0);

    const impactTypeCounts: Record<string, number> = {};
    ppList.forEach(pp => {
      if (pp.impactType && Array.isArray(pp.impactType)) {
        pp.impactType.forEach(impact => {
          impactTypeCounts[impact] = (impactTypeCounts[impact] || 0) + 1;
        });
      }
    });
    const impactTypeData = Object.entries(impactTypeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    res.json({
      summary: {
        businessUnits: buList.length,
        processes: processList.length,
        painPoints: ppList.length,
        solutions: solutionList.length,
        totalFTE,
        totalProcessFTE: Math.round(totalProcessFTE * 10) / 10,
        totalHoursWasted: Math.round(totalHoursWasted),
        avgPainPointsPerProcess: processList.length > 0 ? (ppList.length / processList.length).toFixed(1) : "0"
      },
      charts: {
        severityBreakdown,
        businessUnitBreakdown: buBreakdown,
        processL1Breakdown: impactTypeData
      }
    });
  } catch (error) {
    console.error("Error fetching company insights:", error);
    res.status(500).json({ message: "Failed to fetch company insights" });
  }
});

router.post("/companies/:companyId/structure/upload", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const { companyId } = req.params;
    
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded or invalid file type. Only Excel files (.xlsx, .xls) are accepted." });
      return;
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    
    let buCreated = 0;
    let processCreated = 0;
    const errors: string[] = [];

    const existingBUs = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));
    const buNameMap = new Map(existingBUs.map(bu => [bu.name.toLowerCase(), bu]));

    if (workbook.SheetNames.includes("Business Units")) {
      const buSheet = workbook.Sheets["Business Units"];
      const buData = XLSX.utils.sheet_to_json<Record<string, unknown>>(buSheet);
      
      const l1Bus = buData.filter(row => String(row["Level"] || "").toUpperCase() === "L1");
      for (const row of l1Bus) {
        const name = String(row["Business Unit Name"] || "").trim();
        if (!name) continue;
        
        if (!buNameMap.has(name.toLowerCase())) {
          const fteValue = Math.round(parseFloat(String(row["FTE"] || 0)) || 0);
          const [created] = await db.insert(businessUnits).values({
            name,
            companyId,
            description: String(row["Description"] || "") || null,
            fte: fteValue
          }).returning();
          buNameMap.set(name.toLowerCase(), created);
          buCreated++;
        }
      }

      const l2Bus = buData.filter(row => String(row["Level"] || "").toUpperCase() === "L2");
      for (const row of l2Bus) {
        const name = String(row["Business Unit Name"] || "").trim();
        const parentName = String(row["Parent"] || "").trim();
        if (!name) continue;
        
        const parentBu = parentName ? buNameMap.get(parentName.toLowerCase()) : null;
        if (parentName && !parentBu) {
          errors.push(`Parent "${parentName}" not found for L2 unit "${name}"`);
          continue;
        }
        
        if (!buNameMap.has(name.toLowerCase())) {
          const fteValue = Math.round(parseFloat(String(row["FTE"] || 0)) || 0);
          const [created] = await db.insert(businessUnits).values({
            name,
            companyId,
            parentId: parentBu?.id || null,
            description: String(row["Description"] || "") || null,
            fte: fteValue
          }).returning();
          buNameMap.set(name.toLowerCase(), created);
          buCreated++;
        }
      }

      const l3Bus = buData.filter(row => String(row["Level"] || "").toUpperCase() === "L3");
      for (const row of l3Bus) {
        const name = String(row["Business Unit Name"] || "").trim();
        const parentName = String(row["Parent"] || "").trim();
        if (!name) continue;
        
        const parentBu = parentName ? buNameMap.get(parentName.toLowerCase()) : null;
        if (parentName && !parentBu) {
          errors.push(`Parent "${parentName}" not found for L3 unit "${name}"`);
          continue;
        }
        
        if (!buNameMap.has(name.toLowerCase())) {
          const fteValue = Math.round(parseFloat(String(row["FTE"] || 0)) || 0);
          const [created] = await db.insert(businessUnits).values({
            name,
            companyId,
            parentId: parentBu?.id || null,
            description: String(row["Description"] || "") || null,
            fte: fteValue
          }).returning();
          buNameMap.set(name.toLowerCase(), created);
          buCreated++;
        }
      }
    }

    const refreshedBUs = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));
    const refreshedBuNameMap = new Map(refreshedBUs.map(bu => [bu.name.toLowerCase(), bu]));

    if (workbook.SheetNames.includes("Processes")) {
      const processSheet = workbook.Sheets["Processes"];
      const processData = XLSX.utils.sheet_to_json<Record<string, unknown>>(processSheet);

      for (const row of processData) {
        const processName = String(row["Process Name"] || "").trim();
        if (!processName) continue;

        const buL1 = String(row["Business Unit L1"] || "").trim();
        const buL2 = String(row["Business Unit L2"] || "").trim();
        const buL3 = String(row["Business Unit L3"] || "").trim();
        
        let targetBuId: string | null = null;
        if (buL3 && refreshedBuNameMap.has(buL3.toLowerCase())) {
          targetBuId = refreshedBuNameMap.get(buL3.toLowerCase())?.id || null;
        } else if (buL2 && refreshedBuNameMap.has(buL2.toLowerCase())) {
          targetBuId = refreshedBuNameMap.get(buL2.toLowerCase())?.id || null;
        } else if (buL1 && refreshedBuNameMap.has(buL1.toLowerCase())) {
          targetBuId = refreshedBuNameMap.get(buL1.toLowerCase())?.id || null;
        }

        const volumeStr = String(row["Volume"] || "").trim();
        const fteStr = String(row["FTE"] || "").trim();

        await db.insert(processes).values({
          name: processName,
          businessId: companyId,
          businessUnitId: targetBuId,
          description: String(row["Description"] || "") || null,
          volume: volumeStr || null,
          volumeUnit: String(row["Volume Unit"] || "") || null,
          fte: fteStr || null,
          owner: String(row["Owner"] || "") || null,
          systemsUsed: String(row["Systems Used"] || "") || null
        });
        processCreated++;
      }
    }

    res.json({
      message: "Structure uploaded successfully",
      created: {
        businessUnits: buCreated,
        processes: processCreated
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error uploading company structure:", error);
    res.status(500).json({ message: "Failed to upload company structure" });
  }
});

export default router;
