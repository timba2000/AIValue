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
    const businessUnitId = req.query.businessUnitId as string;
    
    if (!businessUnitId) {
      res.status(400).json({ message: "Business unit ID is required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const businessUnit = await db.select().from(businessUnits).where(eq(businessUnits.id, businessUnitId)).limit(1);
    if (businessUnit.length === 0) {
      res.status(404).json({ message: "Business unit not found" });
      return;
    }

    const companyId = businessUnit[0].companyId;

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const existingProcesses = await db.select().from(processes).where(eq(processes.businessUnitId, businessUnitId));

    const rows = data.map((row, index) => {
      const l1Process = row["L1 Process"] || row.l1Process || "";
      const l2Process = row["L2 Process"] || row.l2Process || "";
      const l3Process = row["L3 Process"] || row.l3Process || "";
      
      let processName = row["Process Name"] || row.processName || row.name || row.Name || "";
      
      if (!processName && l1Process) {
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
      
      if (!processName && !l1Process) {
        errors.push("Process name or L1 Process is required");
      }

      const isDuplicate = existingProcesses.some(p => 
        p.name.toLowerCase() === String(processName).toLowerCase()
      );
      
      if (isDuplicate) {
        errors.push("Process already exists in this business unit");
      }

      return {
        rowIndex: index + 2,
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
      businessUnit: businessUnit[0],
      companyId
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to parse Excel file" });
  }
});

router.post("/import", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const businessUnitId = req.query.businessUnitId as string;
    
    if (!businessUnitId) {
      res.status(400).json({ message: "Business unit ID is required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const businessUnit = await db.select().from(businessUnits).where(eq(businessUnits.id, businessUnitId)).limit(1);
    if (businessUnit.length === 0) {
      res.status(404).json({ message: "Business unit not found" });
      return;
    }

    const companyId = businessUnit[0].companyId;

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    const existingProcesses = await db.select().from(processes).where(eq(processes.businessUnitId, businessUnitId));

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      const l1Process = row["L1 Process"] || row.l1Process || "";
      const l2Process = row["L2 Process"] || row.l2Process || "";
      const l3Process = row["L3 Process"] || row.l3Process || "";
      
      let processName = row["Process Name"] || row.processName || row.name || row.Name || "";
      
      if (!processName && l1Process) {
        const parts = [l1Process, l2Process, l3Process].filter(Boolean);
        processName = parts.join(" > ");
      }

      if (!processName) {
        skipped++;
        errors.push({ row: i + 2, error: "Process name or L1 Process is required" });
        continue;
      }

      const isDuplicate = existingProcesses.some(p => 
        p.name.toLowerCase() === String(processName).toLowerCase()
      );
      
      if (isDuplicate) {
        skipped++;
        errors.push({ row: i + 2, error: "Process already exists in this business unit" });
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
          businessUnitId: businessUnitId,
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
    const businessUnitId = req.query.businessUnitId as string;
    
    let processesToExport;
    if (businessUnitId) {
      processesToExport = await db.select().from(processes).where(eq(processes.businessUnitId, businessUnitId));
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
        "Business Unit": "(Selected business unit)",
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
        "Business Unit": "(Selected business unit)",
        "L1 Process": "HR",
        "L2 Process": "Recruitment",
        "L3 Process": "",
        "Process Name": "",
        "Description": "Hiring process for new employees",
        "Volume": 20,
        "Volume Unit": "per month",
        "FTE": 1,
        "Owner": "Jane Doe",
        "Systems Used": "Workday"
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
