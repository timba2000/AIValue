import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db/client.js";
import { painPoints, processes, processPainPoints, taxonomyCategories } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

interface ExcelRow {
  statement?: string;
  Statement?: string;
  impactType?: string;
  "Impact Type"?: string;
  businessImpact?: string;
  "Business Impact"?: string;
  magnitude?: number | string;
  Magnitude?: number | string;
  "Impact (1-10)"?: number | string;
  frequency?: string | number;
  Frequency?: string | number;
  "Frequency (per month)"?: string | number;
  timePerUnit?: string | number;
  "Time Per Unit"?: string | number;
  "Time Required per unit (Hrs)"?: string | number;
  fteCount?: string | number;
  "FTE Count"?: string | number;
  "# FTE on painpoint"?: string | number;
  rootCause?: string;
  "Root Cause"?: string;
  workarounds?: string;
  Workarounds?: string;
  "Current Workarounds"?: string;
  dependencies?: string;
  Dependencies?: string;
  riskLevel?: string;
  "Risk Level"?: string;
  effortSolving?: number | string;
  "Effort Solving"?: number | string;
  "Effort in Solving (1-10)"?: number | string;
  processName?: string;
  "Process Name"?: string;
  Process?: string;
  taxonomyL1?: string;
  "L1 - Category"?: string;
  "Category"?: string;
  taxonomyL2?: string;
  "L2 - Sub-category"?: string;
  "Sub-category"?: string;
  taxonomyL3?: string;
  "L3 - Description"?: string;
  "Detail"?: string;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

function parseImpactType(val: unknown): string[] | null {
  if (!val || typeof val !== "string") return null;
  const types = val.split(",").map(t => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
  const validTypes = ["time_waste", "quality_issue", "compliance_risk", "cost_overrun", "customer_impact", "other"];
  const filtered = types.filter(t => validTypes.includes(t));
  return filtered.length > 0 ? filtered : null;
}

function parseRiskLevel(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const level = val.trim().toLowerCase();
  const validLevels = ["low", "medium", "high", "critical"];
  return validLevels.includes(level) ? level : null;
}

router.post("/preview", upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const allProcesses = await db.select().from(processes);
    const allTaxonomy = await db.select().from(taxonomyCategories);

    const rows = data.map((row, index) => {
      const statement = row.statement || row.Statement || "";
      const impactTypeRaw = row.impactType || row["Impact Type"] || "";
      const businessImpact = row.businessImpact || row["Business Impact"] || "";
      const magnitude = row.magnitude || row.Magnitude || row["Impact (1-10)"] || "";
      const frequency = row.frequency || row.Frequency || row["Frequency (per month)"] || "";
      const timePerUnit = row.timePerUnit || row["Time Per Unit"] || row["Time Required per unit (Hrs)"] || "";
      const fteCount = row.fteCount || row["FTE Count"] || row["# FTE on painpoint"] || "";
      const rootCause = row.rootCause || row["Root Cause"] || "";
      const workarounds = row.workarounds || row.Workarounds || row["Current Workarounds"] || "";
      const dependencies = row.dependencies || row.Dependencies || "";
      const riskLevel = row.riskLevel || row["Risk Level"] || "";
      const effortSolving = row.effortSolving || row["Effort Solving"] || row["Effort in Solving (1-10)"] || "";
      const processName = row.processName || row["Process Name"] || row.Process || "";
      const taxonomyL1Name = row.taxonomyL1 || row["L1 - Category"] || row["Category"] || "";
      const taxonomyL2Name = row.taxonomyL2 || row["L2 - Sub-category"] || row["Sub-category"] || "";
      const taxonomyL3Name = row.taxonomyL3 || row["L3 - Description"] || row["Detail"] || "";

      const matchedProcess = processName ? allProcesses.find(p => 
        p.name.toLowerCase() === String(processName).toLowerCase()
      ) : null;

      const matchedL1 = taxonomyL1Name ? allTaxonomy.find(t => 
        t.level === 1 && t.name.toLowerCase() === String(taxonomyL1Name).toLowerCase()
      ) : null;

      const matchedL2 = taxonomyL2Name && matchedL1 ? allTaxonomy.find(t => 
        t.level === 2 && t.parentId === matchedL1.id && t.name.toLowerCase() === String(taxonomyL2Name).toLowerCase()
      ) : null;

      const matchedL3 = taxonomyL3Name && matchedL2 ? allTaxonomy.find(t => 
        t.level === 3 && t.parentId === matchedL2.id && t.name.toLowerCase() === String(taxonomyL3Name).toLowerCase()
      ) : null;

      const errors: string[] = [];
      if (!statement) errors.push("Statement is required");
      if (processName && !matchedProcess) errors.push(`Process "${processName}" not found`);
      if (taxonomyL1Name && !matchedL1) errors.push(`L1 Category "${taxonomyL1Name}" not found`);
      if (taxonomyL2Name && !matchedL2) errors.push(`L2 Sub-category "${taxonomyL2Name}" not found`);
      if (taxonomyL3Name && !matchedL3) errors.push(`L3 Description "${taxonomyL3Name}" not found`);

      return {
        rowIndex: index + 2,
        statement: String(statement),
        impactType: parseImpactType(impactTypeRaw),
        businessImpact: String(businessImpact) || null,
        magnitude: parseNumber(magnitude),
        frequency: parseNumber(frequency),
        timePerUnit: parseNumber(timePerUnit),
        fteCount: parseNumber(fteCount),
        rootCause: String(rootCause) || null,
        workarounds: String(workarounds) || null,
        dependencies: String(dependencies) || null,
        riskLevel: parseRiskLevel(riskLevel),
        effortSolving: parseNumber(effortSolving),
        processName: String(processName) || null,
        processId: matchedProcess?.id || null,
        taxonomyL1Name: String(taxonomyL1Name) || null,
        taxonomyLevel1Id: matchedL1?.id || null,
        taxonomyL2Name: String(taxonomyL2Name) || null,
        taxonomyLevel2Id: matchedL2?.id || null,
        taxonomyL3Name: String(taxonomyL3Name) || null,
        taxonomyLevel3Id: matchedL3?.id || null,
        errors,
        isValid: errors.length === 0 && !!statement
      };
    });

    res.json({
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      rows
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to parse Excel file" });
  }
});

router.post("/import", upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const allProcesses = await db.select().from(processes);
    const allTaxonomy = await db.select().from(taxonomyCategories);

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const statement = row.statement || row.Statement || "";

      if (!statement) {
        skipped++;
        errors.push({ row: i + 2, error: "Statement is required" });
        continue;
      }

      const impactTypeRaw = row.impactType || row["Impact Type"] || "";
      const businessImpact = row.businessImpact || row["Business Impact"] || "";
      const magnitude = row.magnitude || row.Magnitude || row["Impact (1-10)"] || "";
      const frequency = row.frequency || row.Frequency || row["Frequency (per month)"] || "";
      const timePerUnit = row.timePerUnit || row["Time Per Unit"] || row["Time Required per unit (Hrs)"] || "";
      const fteCount = row.fteCount || row["FTE Count"] || row["# FTE on painpoint"] || "";
      const rootCause = row.rootCause || row["Root Cause"] || "";
      const workarounds = row.workarounds || row.Workarounds || row["Current Workarounds"] || "";
      const dependencies = row.dependencies || row.Dependencies || "";
      const riskLevel = row.riskLevel || row["Risk Level"] || "";
      const effortSolving = row.effortSolving || row["Effort Solving"] || row["Effort in Solving (1-10)"] || "";
      const processName = row.processName || row["Process Name"] || row.Process || "";
      const taxonomyL1Name = row.taxonomyL1 || row["L1 - Category"] || row["Category"] || "";
      const taxonomyL2Name = row.taxonomyL2 || row["L2 - Sub-category"] || row["Sub-category"] || "";
      const taxonomyL3Name = row.taxonomyL3 || row["L3 - Description"] || row["Detail"] || "";

      const matchedProcess = processName ? allProcesses.find(p => 
        p.name.toLowerCase() === String(processName).toLowerCase()
      ) : null;

      const matchedL1 = taxonomyL1Name ? allTaxonomy.find(t => 
        t.level === 1 && t.name.toLowerCase() === String(taxonomyL1Name).toLowerCase()
      ) : null;

      const matchedL2 = taxonomyL2Name && matchedL1 ? allTaxonomy.find(t => 
        t.level === 2 && t.parentId === matchedL1.id && t.name.toLowerCase() === String(taxonomyL2Name).toLowerCase()
      ) : null;

      const matchedL3 = taxonomyL3Name && matchedL2 ? allTaxonomy.find(t => 
        t.level === 3 && t.parentId === matchedL2.id && t.name.toLowerCase() === String(taxonomyL3Name).toLowerCase()
      ) : null;

      const rowErrors: string[] = [];
      if (processName && !matchedProcess) rowErrors.push(`Process "${processName}" not found`);
      if (taxonomyL1Name && !matchedL1) rowErrors.push(`L1 Category "${taxonomyL1Name}" not found`);
      if (taxonomyL2Name && !matchedL2) rowErrors.push(`L2 Sub-category "${taxonomyL2Name}" not found`);
      if (taxonomyL3Name && !matchedL3) rowErrors.push(`L3 Description "${taxonomyL3Name}" not found`);

      if (rowErrors.length > 0) {
        skipped++;
        errors.push({ row: i + 2, error: rowErrors.join("; ") });
        continue;
      }

      try {
        const freqNum = parseNumber(frequency);
        const timeNum = parseNumber(timePerUnit);
        const totalHoursPerMonth = freqNum !== null && timeNum !== null ? freqNum * timeNum : null;

        const [insertedPainPoint] = await db.insert(painPoints).values({
          statement: String(statement),
          impactType: parseImpactType(impactTypeRaw),
          businessImpact: String(businessImpact) || null,
          magnitude: parseNumber(magnitude)?.toString() || null,
          frequency: freqNum?.toString() || null,
          timePerUnit: timeNum?.toString() || null,
          totalHoursPerMonth: totalHoursPerMonth?.toString() || null,
          fteCount: parseNumber(fteCount)?.toString() || null,
          rootCause: String(rootCause) || null,
          workarounds: String(workarounds) || null,
          dependencies: String(dependencies) || null,
          riskLevel: parseRiskLevel(riskLevel),
          effortSolving: parseNumber(effortSolving)?.toString() || null,
          taxonomyLevel1Id: matchedL1?.id || null,
          taxonomyLevel2Id: matchedL2?.id || null,
          taxonomyLevel3Id: matchedL3?.id || null
        }).returning();

        if (matchedProcess && insertedPainPoint) {
          await db.insert(processPainPoints).values({
            processId: matchedProcess.id,
            painPointId: insertedPainPoint.id
          });
        }

        imported++;
      } catch (err) {
        skipped++;
        errors.push({ row: i + 2, error: "Database error while importing row" });
      }
    }

    res.json({
      imported,
      skipped,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to import Excel file" });
  }
});

router.get("/template-info", async (_req, res) => {
  const allProcesses = await db.select({ id: processes.id, name: processes.name }).from(processes);
  const allTaxonomy = await db.select().from(taxonomyCategories);

  const l1Categories = allTaxonomy.filter(t => t.level === 1);
  const l2Categories = allTaxonomy.filter(t => t.level === 2);
  const l3Categories = allTaxonomy.filter(t => t.level === 3);

  res.json({
    columns: [
      { name: "Statement", required: true, description: "Description of the pain point" },
      { name: "Impact Type", required: false, description: "Comma-separated: time_waste, quality_issue, compliance_risk, cost_overrun, customer_impact, other" },
      { name: "Business Impact", required: false, description: "Description of business impact" },
      { name: "Impact (1-10)", required: false, description: "Magnitude score 1-10" },
      { name: "Frequency (per month)", required: false, description: "Number of occurrences per month" },
      { name: "Time Required per unit (Hrs)", required: false, description: "Hours spent per occurrence" },
      { name: "# FTE on painpoint", required: false, description: "Number of FTEs affected" },
      { name: "Root Cause", required: false, description: "Root cause analysis" },
      { name: "Current Workarounds", required: false, description: "Current workarounds in place" },
      { name: "Dependencies", required: false, description: "System or process dependencies" },
      { name: "Risk Level", required: false, description: "low, medium, high, or critical" },
      { name: "Effort in Solving (1-10)", required: false, description: "Effort score 1-10" },
      { name: "Process Name", required: false, description: "Name of the associated process" },
      { name: "L1 - Category", required: false, description: "Level 1 taxonomy category" },
      { name: "L2 - Sub-category", required: false, description: "Level 2 taxonomy sub-category" },
      { name: "L3 - Description", required: false, description: "Level 3 taxonomy description" }
    ],
    processes: allProcesses,
    taxonomyL1: l1Categories,
    taxonomyL2: l2Categories,
    taxonomyL3: l3Categories
  });
});

router.get("/export", async (_req, res) => {
  try {
    const allPainPoints = await db.select().from(painPoints);
    const allProcesses = await db.select().from(processes);
    const allTaxonomy = await db.select().from(taxonomyCategories);
    const allProcessPainPoints = await db.select().from(processPainPoints);

    const rows = allPainPoints.map(pp => {
      const processLinks = allProcessPainPoints.filter(ppp => ppp.painPointId === pp.id);
      const processNames = processLinks
        .map(link => allProcesses.find(p => p.id === link.processId)?.name)
        .filter(Boolean)
        .join(", ");

      const l1 = pp.taxonomyLevel1Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel1Id) : null;
      const l2 = pp.taxonomyLevel2Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel2Id) : null;
      const l3 = pp.taxonomyLevel3Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel3Id) : null;

      return {
        "Statement": pp.statement || "",
        "Impact Type": pp.impactType ? pp.impactType.join(", ") : "",
        "Business Impact": pp.businessImpact || "",
        "Impact (1-10)": pp.magnitude ? Number(pp.magnitude) : "",
        "Frequency (per month)": pp.frequency ? Number(pp.frequency) : "",
        "Time Required per unit (Hrs)": pp.timePerUnit ? Number(pp.timePerUnit) : "",
        "# FTE on painpoint": pp.fteCount ? Number(pp.fteCount) : "",
        "Root Cause": pp.rootCause || "",
        "Current Workarounds": pp.workarounds || "",
        "Dependencies": pp.dependencies || "",
        "Risk Level": pp.riskLevel || "",
        "Effort in Solving (1-10)": pp.effortSolving ? Number(pp.effortSolving) : "",
        "Process Name": processNames,
        "L1 - Category": l1?.name || "",
        "L2 - Sub-category": l2?.name || "",
        "L3 - Description": l3?.name || ""
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    const colWidths = [
      { wch: 50 },
      { wch: 20 },
      { wch: 30 },
      { wch: 12 },
      { wch: 20 },
      { wch: 25 },
      { wch: 18 },
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 22 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Pain Points");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="pain_points_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to export pain points" });
  }
});

export default router;
