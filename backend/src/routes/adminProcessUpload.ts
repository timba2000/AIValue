import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db/client.js";
import { processes, companies, businessUnits } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

interface ExcelRow {
  "Business Unit"?: string;
  "Business Unit (Optional)"?: string;
  businessUnit?: string;
  "L1 Process"?: string;
  l1Process?: string;
  "L2 Process"?: string;
  l2Process?: string;
  "L3 Process"?: string;
  l3Process?: string;
  "Process Name"?: string;
  processName?: string;
  name?: string;
  Name?: string;
  description?: string;
  Description?: string;
  volume?: string | number;
  Volume?: string | number;
  "Volume Unit"?: string;
  volumeUnit?: string;
  fte?: string | number;
  FTE?: string | number;
  owner?: string;
  Owner?: string;
  "Systems Used"?: string;
  systemsUsed?: string;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

router.post("/preview", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;
    const businessUnitId = req.query.businessUnitId as string | undefined;
    
    if (!companyId) {
      res.status(400).json({ message: "Company ID is required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (company.length === 0) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const companyBusinessUnits = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const existingProcesses = await db.select().from(processes).where(eq(processes.businessId, companyId));

    const rows = data.map((row, index) => {
      const businessUnitName = row["Business Unit"] || row["Business Unit (Optional)"] || row.businessUnit || "";
      const l1Process = (row["L1 Process"] || row.l1Process || "").toString().trim();
      const l2Process = (row["L2 Process"] || row.l2Process || "").toString().trim();
      const l3Process = (row["L3 Process"] || row.l3Process || "").toString().trim();
      
      let processName = row["Process Name"] || row.processName || row.name || row.Name || "";
      
      // Build hierarchical name from L1 > L2 > L3 if process name not explicitly provided
      if (!processName) {
        const parts = [l1Process, l2Process, l3Process].filter(Boolean);
        processName = parts.join(" > ");
      }

      const description = row.description || row.Description || "";
      const volume = row.volume || row.Volume || "";
      const volumeUnit = row["Volume Unit"] || row.volumeUnit || "";
      const fte = row.fte || row.FTE || "";
      const owner = row.owner || row.Owner || "";
      const systemsUsed = row["Systems Used"] || row.systemsUsed || "";

      const errors: string[] = [];
      
      if (!processName) {
        errors.push("Process name or L3/L2/L1 Process is required");
      }

      let matchedBusinessUnit = null;
      if (businessUnitId) {
        matchedBusinessUnit = companyBusinessUnits.find(bu => bu.id === businessUnitId);
      } else if (businessUnitName) {
        matchedBusinessUnit = companyBusinessUnits.find(bu => 
          bu.name.toLowerCase() === String(businessUnitName).toLowerCase()
        );
        if (!matchedBusinessUnit) {
          errors.push(`Business Unit "${businessUnitName}" not found in this company (will be skipped, can assign later)`);
        }
      }

      const targetBuId = matchedBusinessUnit?.id ?? null;
      const isDuplicate = existingProcesses.some(p => 
        p.name.toLowerCase() === String(processName).toLowerCase() &&
        (p.businessUnitId ?? null) === targetBuId
      );
      
      if (isDuplicate) {
        errors.push("Process already exists" + (matchedBusinessUnit ? " in this business unit" : ""));
      }

      return {
        rowIndex: index + 2,
        businessUnitName: String(businessUnitName) || null,
        businessUnitId: targetBuId,
        l1Process: String(l1Process) || null,
        l2Process: String(l2Process) || null,
        l3Process: String(l3Process) || null,
        processName: String(processName),
        description: String(description) || null,
        volume: parseNumber(volume),
        volumeUnit: String(volumeUnit) || null,
        fte: parseNumber(fte),
        owner: String(owner) || null,
        systemsUsed: String(systemsUsed) || null,
        errors,
        isValid: errors.length === 0 && !!processName,
        isDuplicate
      };
    });

    res.json({
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      duplicateRows: rows.filter(r => r.isDuplicate).length,
      rows,
      company: company[0],
      businessUnits: companyBusinessUnits
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to parse Excel file" });
  }
});

router.post("/import", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;
    const businessUnitId = req.query.businessUnitId as string | undefined;
    
    if (!companyId) {
      res.status(400).json({ message: "Company ID is required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (company.length === 0) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const companyBusinessUnits = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId));

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const existingProcesses = await db.select().from(processes).where(eq(processes.businessId, companyId));

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      const businessUnitName = row["Business Unit"] || row["Business Unit (Optional)"] || row.businessUnit || "";
      const l1Process = (row["L1 Process"] || row.l1Process || "").toString().trim();
      const l2Process = (row["L2 Process"] || row.l2Process || "").toString().trim();
      const l3Process = (row["L3 Process"] || row.l3Process || "").toString().trim();
      
      let processName = row["Process Name"] || row.processName || row.name || row.Name || "";
      
      // Build hierarchical name from L1 > L2 > L3 if process name not explicitly provided
      if (!processName) {
        const parts = [l1Process, l2Process, l3Process].filter(Boolean);
        processName = parts.join(" > ");
      }

      if (!processName) {
        skipped++;
        errors.push({ row: i + 2, error: "Process name or L3/L2/L1 Process is required" });
        continue;
      }

      let matchedBusinessUnit = null;
      if (businessUnitId) {
        matchedBusinessUnit = companyBusinessUnits.find(bu => bu.id === businessUnitId);
      } else if (businessUnitName) {
        matchedBusinessUnit = companyBusinessUnits.find(bu => 
          bu.name.toLowerCase() === String(businessUnitName).toLowerCase()
        );
        if (!matchedBusinessUnit) {
          skipped++;
          errors.push({ row: i + 2, error: `Business Unit "${businessUnitName}" not found - can assign later via edit` });
          continue;
        }
      }

      const targetBuId = matchedBusinessUnit?.id ?? null;
      const isDuplicate = existingProcesses.some(p => 
        p.name.toLowerCase() === String(processName).toLowerCase() &&
        (p.businessUnitId ?? null) === targetBuId
      );
      
      if (isDuplicate) {
        skipped++;
        errors.push({ row: i + 2, error: "Process already exists" + (matchedBusinessUnit ? " in this business unit" : "") });
        continue;
      }

      const description = row.description || row.Description || "";
      const volume = row.volume || row.Volume || "";
      const volumeUnit = row["Volume Unit"] || row.volumeUnit || "";
      const fte = row.fte || row.FTE || "";
      const owner = row.owner || row.Owner || "";
      const systemsUsed = row["Systems Used"] || row.systemsUsed || "";

      try {
        const [newProcess] = await db.insert(processes).values({
          businessId: companyId,
          businessUnitId: targetBuId,
          name: String(processName),
          description: String(description) || null,
          volume: parseNumber(volume)?.toString() || null,
          volumeUnit: String(volumeUnit) || null,
          fte: parseNumber(fte)?.toString() || null,
          owner: String(owner) || null,
          systemsUsed: String(systemsUsed) || null
        }).returning();

        existingProcesses.push(newProcess);
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

router.get("/export", async (req, res): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;
    const businessUnitId = req.query.businessUnitId as string;
    
    let processesToExport;
    if (businessUnitId) {
      processesToExport = await db.select().from(processes).where(eq(processes.businessUnitId, businessUnitId));
    } else if (companyId) {
      processesToExport = await db.select().from(processes).where(eq(processes.businessId, companyId));
    } else {
      processesToExport = await db.select().from(processes);
    }

    const allBusinessUnits = await db.select().from(businessUnits);

    const rows = processesToExport.map(p => {
      const bu = allBusinessUnits.find(b => b.id === p.businessUnitId);
      
      const nameParts = p.name.split(" > ");
      const l1 = nameParts[0] || "";
      const l2 = nameParts[1] || "";
      const l3 = nameParts[2] || "";

      return {
        "Business Unit": bu?.name || "",
        "L1 Process": l1,
        "L2 Process": l2,
        "L3 Process": l3,
        "Process Name": p.name,
        "Description": p.description || "",
        "Volume": p.volume ? Number(p.volume) : "",
        "Volume Unit": p.volumeUnit || "",
        "FTE": p.fte ? Number(p.fte) : "",
        "Owner": p.owner || "",
        "Systems Used": p.systemsUsed || ""
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    const colWidths = [
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 40 },
      { wch: 40 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 30 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Processes");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="processes_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to export processes" });
  }
});

router.get("/template", async (_req, res): Promise<void> => {
  try {
    const templateRows = [
      {
        "Business Unit (Optional)": "Sales",
        "L1 Process": "Finance",
        "L2 Process": "Accounts Payable",
        "L3 Process": "Invoice Processing",
        "Process Name": "",
        "Description": "Process for handling vendor invoices",
        "Volume": 500,
        "Volume Unit": "per month",
        "FTE": 2.5,
        "Owner": "John Smith",
        "Systems Used": "SAP, Excel"
      },
      {
        "Business Unit (Optional)": "Sales",
        "L1 Process": "Finance",
        "L2 Process": "Accounts Payable",
        "L3 Process": "Payment Approval",
        "Process Name": "",
        "Description": "Review and approve payments (same L1/L2, different L3)",
        "Volume": 300,
        "Volume Unit": "per month",
        "FTE": 1.5,
        "Owner": "John Smith",
        "Systems Used": "SAP"
      },
      {
        "Business Unit (Optional)": "Sales",
        "L1 Process": "Finance",
        "L2 Process": "Accounts Receivable",
        "L3 Process": "Collections",
        "Process Name": "",
        "Description": "Collect outstanding payments (same L1, different L2)",
        "Volume": 200,
        "Volume Unit": "per month",
        "FTE": 2,
        "Owner": "Mary Johnson",
        "Systems Used": "SAP, CRM"
      },
      {
        "Business Unit (Optional)": "",
        "L1 Process": "HR",
        "L2 Process": "Recruitment",
        "L3 Process": "",
        "Process Name": "",
        "Description": "Hiring process (L1 + L2 only, no L3)",
        "Volume": 20,
        "Volume Unit": "per month",
        "FTE": 1,
        "Owner": "Jane Doe",
        "Systems Used": "Workday"
      },
      {
        "Business Unit (Optional)": "",
        "L1 Process": "HR",
        "L2 Process": "Onboarding",
        "L3 Process": "New Employee Setup",
        "Process Name": "",
        "Description": "Setup accounts for new hires (same L1, different L2)",
        "Volume": 15,
        "Volume Unit": "per month",
        "FTE": 0.5,
        "Owner": "Jane Doe",
        "Systems Used": "Workday, JIRA"
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateRows);

    const colWidths = [
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 40 },
      { wch: 40 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 30 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Process Template");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="process_upload_template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate template" });
  }
});

export default router;
