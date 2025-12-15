import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db/client.js";
import { painPoints, processes, processPainPoints, taxonomyCategories, companies, businessUnits } from "../db/schema.js";
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
  company?: string;
  Company?: string;
  "Business"?: string;
  businessUnit?: string;
  "Business Unit"?: string;
  subUnit?: string;
  "Sub Unit"?: string;
  "Sub-unit"?: string;
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
    const allCompanies = await db.select().from(companies);
    const allBusinessUnits = await db.select().from(businessUnits);

    const missingCategories: { l1Name: string; l2Name: string | null; l3Name: string | null; level: number }[] = [];
    const missingCompanies: string[] = [];
    const missingBusinessUnits: { companyName: string; businessUnitName: string }[] = [];
    const missingSubUnits: { companyName: string; businessUnitName: string; subUnitName: string }[] = [];
    const seenMissing = new Set<string>();
    const seenMissingCompanies = new Set<string>();
    const seenMissingBUs = new Set<string>();
    const seenMissingSubUnits = new Set<string>();

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
      
      const companyName = row.company || row.Company || row["Business"] || "";
      const businessUnitName = row.businessUnit || row["Business Unit"] || "";
      const subUnitName = row.subUnit || row["Sub Unit"] || row["Sub-unit"] || "";

      const matchedCompany = companyName ? allCompanies.find(c => 
        c.name.toLowerCase() === String(companyName).toLowerCase()
      ) : null;
      
      const matchedBusinessUnit = businessUnitName && matchedCompany ? allBusinessUnits.find(bu => 
        bu.companyId === matchedCompany.id && 
        bu.name.toLowerCase() === String(businessUnitName).toLowerCase() &&
        bu.parentId === null
      ) : null;
      
      const matchedSubUnit = subUnitName && matchedBusinessUnit ? allBusinessUnits.find(bu => 
        bu.companyId === matchedCompany?.id && 
        bu.name.toLowerCase() === String(subUnitName).toLowerCase() &&
        bu.parentId === matchedBusinessUnit.id
      ) : null;

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
      const warnings: string[] = [];
      if (!statement) errors.push("Statement is required");
      
      // Company is REQUIRED for import
      if (!companyName) {
        errors.push("Company is required");
      } else if (!matchedCompany) {
        errors.push(`Company "${companyName}" not found - add it first`);
        const companyKey = String(companyName).toLowerCase();
        if (!seenMissingCompanies.has(companyKey)) {
          seenMissingCompanies.add(companyKey);
          missingCompanies.push(String(companyName));
        }
      }
      
      if (processName && !matchedProcess) errors.push(`Process "${processName}" not found`);
      if (taxonomyL1Name && !matchedL1) errors.push(`L1 Category "${taxonomyL1Name}" not found`);
      
      // Business unit and sub-unit are optional, but warn if provided and not found
      if (businessUnitName && matchedCompany && !matchedBusinessUnit) {
        warnings.push(`Business Unit "${businessUnitName}" not found - can be linked later`);
        const buKey = `${String(companyName).toLowerCase()}:${String(businessUnitName).toLowerCase()}`;
        if (!seenMissingBUs.has(buKey)) {
          seenMissingBUs.add(buKey);
          missingBusinessUnits.push({ companyName: String(companyName), businessUnitName: String(businessUnitName) });
        }
      } else if (businessUnitName && !matchedCompany) {
        warnings.push(`Business Unit "${businessUnitName}" skipped (company not found)`);
      }
      if (subUnitName && matchedBusinessUnit && !matchedSubUnit) {
        warnings.push(`Sub Unit "${subUnitName}" not found - can be linked later`);
        const subKey = `${String(companyName).toLowerCase()}:${String(businessUnitName).toLowerCase()}:${String(subUnitName).toLowerCase()}`;
        if (!seenMissingSubUnits.has(subKey)) {
          seenMissingSubUnits.add(subKey);
          missingSubUnits.push({ companyName: String(companyName), businessUnitName: String(businessUnitName), subUnitName: String(subUnitName) });
        }
      } else if (subUnitName && !matchedBusinessUnit) {
        warnings.push(`Sub Unit "${subUnitName}" skipped (business unit not found)`);
      }
      
      if (taxonomyL2Name && matchedL1 && !matchedL2) {
        errors.push(`L2 Sub-category "${taxonomyL2Name}" not found`);
        const key = `L2:${String(taxonomyL1Name).toLowerCase()}:${String(taxonomyL2Name).toLowerCase()}`;
        if (!seenMissing.has(key)) {
          seenMissing.add(key);
          missingCategories.push({ l1Name: String(taxonomyL1Name), l2Name: String(taxonomyL2Name), l3Name: null, level: 2 });
        }
      } else if (taxonomyL2Name && !matchedL1) {
        errors.push(`L2 Sub-category "${taxonomyL2Name}" not found (parent L1 missing)`);
      }
      
      if (taxonomyL3Name && matchedL2 && !matchedL3) {
        errors.push(`L3 Description "${taxonomyL3Name}" not found`);
        const key = `L3:${String(taxonomyL1Name).toLowerCase()}:${String(taxonomyL2Name).toLowerCase()}:${String(taxonomyL3Name).toLowerCase()}`;
        if (!seenMissing.has(key)) {
          seenMissing.add(key);
          missingCategories.push({ l1Name: String(taxonomyL1Name), l2Name: String(taxonomyL2Name), l3Name: String(taxonomyL3Name), level: 3 });
        }
      } else if (taxonomyL3Name && !matchedL2) {
        errors.push(`L3 Description "${taxonomyL3Name}" not found (parent L2 missing)`);
      }

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
        companyName: String(companyName) || null,
        companyId: matchedCompany?.id || null,
        businessUnitName: String(businessUnitName) || null,
        businessUnitId: matchedBusinessUnit?.id || null,
        subUnitName: String(subUnitName) || null,
        subUnitId: matchedSubUnit?.id || null,
        errors,
        warnings,
        isValid: errors.length === 0 && !!statement
      };
    });

    res.json({
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      rows,
      missingCategories,
      missingCompanies,
      missingBusinessUnits,
      missingSubUnits
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
    const allCompanies = await db.select().from(companies);
    const allBusinessUnits = await db.select().from(businessUnits);

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
      
      const companyName = row.company || row.Company || row["Business"] || "";
      const businessUnitName = row.businessUnit || row["Business Unit"] || "";
      const subUnitName = row.subUnit || row["Sub Unit"] || row["Sub-unit"] || "";

      const matchedCompany = companyName ? allCompanies.find(c => 
        c.name.toLowerCase() === String(companyName).toLowerCase()
      ) : null;
      
      const matchedBusinessUnit = businessUnitName && matchedCompany ? allBusinessUnits.find(bu => 
        bu.companyId === matchedCompany.id && 
        bu.name.toLowerCase() === String(businessUnitName).toLowerCase() &&
        bu.parentId === null
      ) : null;
      
      const matchedSubUnit = subUnitName && matchedBusinessUnit ? allBusinessUnits.find(bu => 
        bu.companyId === matchedCompany?.id && 
        bu.name.toLowerCase() === String(subUnitName).toLowerCase() &&
        bu.parentId === matchedBusinessUnit.id
      ) : null;

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
      
      // Company is REQUIRED for all pain points
      if (!companyName) {
        rowErrors.push("Company is required");
      } else if (!matchedCompany) {
        rowErrors.push(`Company "${companyName}" not found`);
      }
      
      // Business unit validation (optional but must match if provided)
      if (businessUnitName && matchedCompany && !matchedBusinessUnit) {
        rowErrors.push(`Business unit "${businessUnitName}" not found under company "${companyName}"`);
      }
      if (subUnitName && matchedBusinessUnit && !matchedSubUnit) {
        rowErrors.push(`Sub-unit "${subUnitName}" not found under business unit "${businessUnitName}"`);
      }
      
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
        
        const linkedBusinessUnitId = matchedSubUnit?.id || matchedBusinessUnit?.id || null;

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
          taxonomyLevel3Id: matchedL3?.id || null,
          companyId: matchedCompany?.id || null,
          businessUnitId: linkedBusinessUnitId
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
      { name: "Company", required: false, description: "Name of the company (optional)" },
      { name: "Business Unit", required: false, description: "Name of the business unit (optional)" },
      { name: "Sub Unit", required: false, description: "Name of the sub-unit (optional)" },
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

router.post("/add-taxonomy", async (req, res): Promise<void> => {
  try {
    const { categories } = req.body as { 
      categories: { l1Name: string; l2Name: string | null; l3Name: string | null; level: number }[] 
    };

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      res.status(400).json({ message: "No categories provided" });
      return;
    }

    const allTaxonomy = await db.select().from(taxonomyCategories);
    let added = 0;
    const errors: { category: string; error: string }[] = [];

    for (const cat of categories) {
      try {
        if (cat.level === 2 && cat.l1Name && cat.l2Name) {
          const l1 = allTaxonomy.find(t => 
            t.level === 1 && t.name.toLowerCase() === cat.l1Name.toLowerCase()
          );
          
          if (!l1) {
            errors.push({ category: `${cat.l1Name} > ${cat.l2Name}`, error: "Parent L1 category not found" });
            continue;
          }

          const existingL2 = allTaxonomy.find(t => 
            t.level === 2 && t.parentId === l1.id && t.name.toLowerCase() === cat.l2Name!.toLowerCase()
          );
          
          if (existingL2) {
            errors.push({ category: `${cat.l1Name} > ${cat.l2Name}`, error: "Already exists" });
            continue;
          }

          const [newL2] = await db.insert(taxonomyCategories).values({
            name: cat.l2Name,
            parentId: l1.id,
            level: 2
          }).returning();
          
          allTaxonomy.push(newL2);
          added++;
        } else if (cat.level === 3 && cat.l1Name && cat.l2Name && cat.l3Name) {
          const l1 = allTaxonomy.find(t => 
            t.level === 1 && t.name.toLowerCase() === cat.l1Name.toLowerCase()
          );
          
          if (!l1) {
            errors.push({ category: `${cat.l1Name} > ${cat.l2Name} > ${cat.l3Name}`, error: "Parent L1 category not found" });
            continue;
          }

          const l2 = allTaxonomy.find(t => 
            t.level === 2 && t.parentId === l1.id && t.name.toLowerCase() === cat.l2Name!.toLowerCase()
          );
          
          if (!l2) {
            errors.push({ category: `${cat.l1Name} > ${cat.l2Name} > ${cat.l3Name}`, error: "Parent L2 category not found" });
            continue;
          }

          const existingL3 = allTaxonomy.find(t => 
            t.level === 3 && t.parentId === l2.id && t.name.toLowerCase() === cat.l3Name!.toLowerCase()
          );
          
          if (existingL3) {
            errors.push({ category: `${cat.l1Name} > ${cat.l2Name} > ${cat.l3Name}`, error: "Already exists" });
            continue;
          }

          const [newL3] = await db.insert(taxonomyCategories).values({
            name: cat.l3Name,
            parentId: l2.id,
            level: 3
          }).returning();
          
          allTaxonomy.push(newL3);
          added++;
        } else {
          errors.push({ category: JSON.stringify(cat), error: "Invalid category format" });
        }
      } catch (err) {
        errors.push({ category: JSON.stringify(cat), error: "Database error" });
      }
    }

    res.json({ added, errors });
  } catch (error) {
    res.status(500).json({ message: "Failed to add taxonomy categories" });
  }
});

router.post("/add-company", async (req, res): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ success: false, message: "Company name is required" });
      return;
    }

    const trimmedName = name.trim();
    const existing = await db.select().from(companies).where(eq(companies.name, trimmedName));
    
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: "Company already exists", existingId: existing[0].id });
      return;
    }

    const [newCompany] = await db.insert(companies).values({
      name: trimmedName
    }).returning();

    res.json({ success: true, company: newCompany, message: `Company "${trimmedName}" created successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create company" });
  }
});

router.post("/add-business-unit", async (req, res): Promise<void> => {
  try {
    const { companyName, businessUnitName, fte } = req.body;
    
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      res.status(400).json({ success: false, message: "Company name is required" });
      return;
    }
    
    if (!businessUnitName || typeof businessUnitName !== "string" || !businessUnitName.trim()) {
      res.status(400).json({ success: false, message: "Business unit name is required" });
      return;
    }

    const trimmedCompany = companyName.trim();
    const trimmedBU = businessUnitName.trim();

    const company = await db.select().from(companies)
      .where(eq(companies.name, trimmedCompany));
    
    if (company.length === 0) {
      res.status(404).json({ success: false, message: `Company "${trimmedCompany}" not found. Please add it first.` });
      return;
    }

    const existingBU = await db.select().from(businessUnits)
      .where(eq(businessUnits.companyId, company[0].id));
    
    const duplicate = existingBU.find(bu => 
      bu.name.toLowerCase() === trimmedBU.toLowerCase() && 
      bu.parentId === null
    );
    
    if (duplicate) {
      res.status(409).json({ success: false, message: "Business unit already exists", existingId: duplicate.id });
      return;
    }

    const [newBU] = await db.insert(businessUnits).values({
      name: trimmedBU,
      companyId: company[0].id,
      fte: fte && !isNaN(Number(fte)) ? Number(fte) : undefined,
      parentId: undefined
    }).returning();

    res.json({ success: true, businessUnit: newBU, message: `Business unit "${trimmedBU}" created successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create business unit" });
  }
});

router.post("/add-sub-unit", async (req, res): Promise<void> => {
  try {
    const { companyName, businessUnitName, subUnitName, fte } = req.body;
    
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      res.status(400).json({ success: false, message: "Company name is required" });
      return;
    }
    
    if (!businessUnitName || typeof businessUnitName !== "string" || !businessUnitName.trim()) {
      res.status(400).json({ success: false, message: "Business unit name is required" });
      return;
    }
    
    if (!subUnitName || typeof subUnitName !== "string" || !subUnitName.trim()) {
      res.status(400).json({ success: false, message: "Sub-unit name is required" });
      return;
    }

    const trimmedCompany = companyName.trim();
    const trimmedBU = businessUnitName.trim();
    const trimmedSub = subUnitName.trim();

    const company = await db.select().from(companies)
      .where(eq(companies.name, trimmedCompany));
    
    if (company.length === 0) {
      res.status(404).json({ success: false, message: `Company "${trimmedCompany}" not found. Please add it first.` });
      return;
    }

    const allUnits = await db.select().from(businessUnits)
      .where(eq(businessUnits.companyId, company[0].id));
    
    const parentBU = allUnits.find(bu => 
      bu.name.toLowerCase() === trimmedBU.toLowerCase() && 
      bu.parentId === null
    );
    
    if (!parentBU) {
      res.status(404).json({ success: false, message: `Business unit "${trimmedBU}" not found. Please add it first.` });
      return;
    }

    const duplicateSub = allUnits.find(bu => 
      bu.name.toLowerCase() === trimmedSub.toLowerCase() && 
      bu.parentId === parentBU.id
    );
    
    if (duplicateSub) {
      res.status(409).json({ success: false, message: "Sub-unit already exists", existingId: duplicateSub.id });
      return;
    }

    const [newSubUnit] = await db.insert(businessUnits).values({
      name: trimmedSub,
      companyId: company[0].id,
      fte: fte && !isNaN(Number(fte)) ? Number(fte) : undefined,
      parentId: parentBU.id
    }).returning();

    res.json({ success: true, subUnit: newSubUnit, message: `Sub-unit "${trimmedSub}" created successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create sub-unit" });
  }
});

router.get("/export", async (_req, res) => {
  try {
    const allPainPoints = await db.select().from(painPoints);
    const allProcesses = await db.select().from(processes);
    const allTaxonomy = await db.select().from(taxonomyCategories);
    const allProcessPainPoints = await db.select().from(processPainPoints);
    const allCompanies = await db.select().from(companies);
    const allBusinessUnits = await db.select().from(businessUnits);

    const rows = allPainPoints.map(pp => {
      const processLinks = allProcessPainPoints.filter(ppp => ppp.painPointId === pp.id);
      const linkedProcesses = processLinks
        .map(link => allProcesses.find(p => p.id === link.processId))
        .filter(Boolean);
      const processNames = linkedProcesses.map(p => p?.name).filter(Boolean).join(", ");

      let company: typeof allCompanies[number] | null = null;
      let businessUnit: typeof allBusinessUnits[number] | null = null;
      let parentUnit: typeof allBusinessUnits[number] | null = null;
      
      if (pp.businessUnitId) {
        const foundUnit = allBusinessUnits.find(bu => bu.id === pp.businessUnitId) || null;
        businessUnit = foundUnit;
        if (foundUnit) {
          company = allCompanies.find(c => c.id === foundUnit.companyId) || null;
          if (foundUnit.parentId) {
            parentUnit = allBusinessUnits.find(bu => bu.id === foundUnit.parentId) || null;
          }
        }
      } else {
        const firstProcess = linkedProcesses[0];
        company = firstProcess ? allCompanies.find(c => c.id === firstProcess.businessId) || null : null;
        const processBusinessUnit = firstProcess ? allBusinessUnits.find(bu => bu.id === firstProcess.businessUnitId) || null : null;
        if (processBusinessUnit) {
          businessUnit = processBusinessUnit;
          if (processBusinessUnit.parentId) {
            parentUnit = allBusinessUnits.find(bu => bu.id === processBusinessUnit.parentId) || null;
          }
        }
      }

      const l1 = pp.taxonomyLevel1Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel1Id) : null;
      const l2 = pp.taxonomyLevel2Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel2Id) : null;
      const l3 = pp.taxonomyLevel3Id ? allTaxonomy.find(t => t.id === pp.taxonomyLevel3Id) : null;

      return {
        "Company": company?.name || "",
        "Business Unit": parentUnit?.name || businessUnit?.name || "",
        "Sub Unit": parentUnit ? businessUnit?.name : "",
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
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
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
