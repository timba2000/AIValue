import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db/client.js";
import { taxonomyCategories } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

interface TaxonomyRow {
  "Level 1"?: string;
  "Level 2"?: string;
  "Level 3"?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  L1?: string;
  L2?: string;
  L3?: string;
}

router.get("/export", async (_req, res) => {
  try {
    const allTaxonomy = await db.select().from(taxonomyCategories);
    
    const l1Categories = allTaxonomy.filter(t => t.level === 1);
    const l2Categories = allTaxonomy.filter(t => t.level === 2);
    const l3Categories = allTaxonomy.filter(t => t.level === 3);

    const rows: { "Level 1": string; "Level 2": string; "Level 3": string }[] = [];

    for (const l3 of l3Categories) {
      const l2 = l2Categories.find(t => t.id === l3.parentId);
      const l1 = l2 ? l1Categories.find(t => t.id === l2.parentId) : null;
      
      rows.push({
        "Level 1": l1?.name || "",
        "Level 2": l2?.name || "",
        "Level 3": l3.name
      });
    }

    for (const l2 of l2Categories) {
      const hasL3Children = l3Categories.some(l3 => l3.parentId === l2.id);
      if (!hasL3Children) {
        const l1 = l1Categories.find(t => t.id === l2.parentId);
        rows.push({
          "Level 1": l1?.name || "",
          "Level 2": l2.name,
          "Level 3": ""
        });
      }
    }

    for (const l1 of l1Categories) {
      const hasL2Children = l2Categories.some(l2 => l2.parentId === l1.id);
      if (!hasL2Children) {
        rows.push({
          "Level 1": l1.name,
          "Level 2": "",
          "Level 3": ""
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 50 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Taxonomy");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="taxonomy_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to export taxonomy" });
  }
});

router.post("/preview", upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<TaxonomyRow>(worksheet);

    const existingTaxonomy = await db.select().from(taxonomyCategories);
    const existingL1 = existingTaxonomy.filter(t => t.level === 1);
    const existingL2 = existingTaxonomy.filter(t => t.level === 2);
    const existingL3 = existingTaxonomy.filter(t => t.level === 3);

    const rows = data.map((row, index) => {
      const l1Name = row["Level 1"] || row.level1 || row.L1 || "";
      const l2Name = row["Level 2"] || row.level2 || row.L2 || "";
      const l3Name = row["Level 3"] || row.level3 || row.L3 || "";

      const l1Exists = existingL1.some(t => t.name.toLowerCase() === String(l1Name).toLowerCase());
      
      const matchedL1 = existingL1.find(t => t.name.toLowerCase() === String(l1Name).toLowerCase());
      const l2Exists = matchedL1 && existingL2.some(t => 
        t.parentId === matchedL1.id && t.name.toLowerCase() === String(l2Name).toLowerCase()
      );
      
      const matchedL2 = matchedL1 && existingL2.find(t => 
        t.parentId === matchedL1.id && t.name.toLowerCase() === String(l2Name).toLowerCase()
      );
      const l3Exists = matchedL2 && existingL3.some(t => 
        t.parentId === matchedL2.id && t.name.toLowerCase() === String(l3Name).toLowerCase()
      );

      const errors: string[] = [];
      if (!l1Name) errors.push("Level 1 is required");

      let status = "new";
      if (l3Name && l3Exists) {
        status = "exists";
      } else if (!l3Name && l2Name && l2Exists) {
        status = "exists";
      } else if (!l3Name && !l2Name && l1Exists) {
        status = "exists";
      }

      return {
        rowIndex: index + 2,
        level1: String(l1Name),
        level2: String(l2Name),
        level3: String(l3Name),
        l1Exists,
        l2Exists: !!l2Exists,
        l3Exists: !!l3Exists,
        status,
        errors,
        isValid: errors.length === 0 && !!l1Name
      };
    });

    const newEntries = rows.filter(r => r.isValid && r.status === "new").length;
    const existingEntries = rows.filter(r => r.status === "exists").length;
    const invalidEntries = rows.filter(r => !r.isValid).length;

    res.json({
      totalRows: rows.length,
      newEntries,
      existingEntries,
      invalidEntries,
      rows
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to parse taxonomy file" });
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
    const data = XLSX.utils.sheet_to_json<TaxonomyRow>(worksheet);

    let created = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    const l1Map = new Map<string, string>();
    const l2Map = new Map<string, string>();

    const existingTaxonomy = await db.select().from(taxonomyCategories);
    for (const t of existingTaxonomy) {
      if (t.level === 1) {
        l1Map.set(t.name.toLowerCase(), t.id);
      } else if (t.level === 2 && t.parentId) {
        l2Map.set(`${t.parentId}:${t.name.toLowerCase()}`, t.id);
      }
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const l1Name = String(row["Level 1"] || row.level1 || row.L1 || "").trim();
      const l2Name = String(row["Level 2"] || row.level2 || row.L2 || "").trim();
      const l3Name = String(row["Level 3"] || row.level3 || row.L3 || "").trim();

      if (!l1Name) {
        skipped++;
        errors.push({ row: i + 2, error: "Level 1 is required" });
        continue;
      }

      try {
        let l1Id = l1Map.get(l1Name.toLowerCase());
        if (!l1Id) {
          const [newL1] = await db.insert(taxonomyCategories).values({
            name: l1Name,
            level: 1,
            parentId: null
          }).returning();
          l1Id = newL1.id;
          l1Map.set(l1Name.toLowerCase(), l1Id);
          created++;
        }

        if (l2Name) {
          const l2Key = `${l1Id}:${l2Name.toLowerCase()}`;
          let l2Id = l2Map.get(l2Key);
          if (!l2Id) {
            const [newL2] = await db.insert(taxonomyCategories).values({
              name: l2Name,
              level: 2,
              parentId: l1Id
            }).returning();
            l2Id = newL2.id;
            l2Map.set(l2Key, l2Id);
            created++;
          }

          if (l3Name) {
            const existingL3 = await db.select().from(taxonomyCategories)
              .where(eq(taxonomyCategories.parentId, l2Id));
            const l3Exists = existingL3.some(t => t.name.toLowerCase() === l3Name.toLowerCase());
            
            if (!l3Exists) {
              await db.insert(taxonomyCategories).values({
                name: l3Name,
                level: 3,
                parentId: l2Id
              });
              created++;
            } else {
              skipped++;
            }
          }
        }
      } catch (err) {
        skipped++;
        errors.push({ row: i + 2, error: "Database error while importing" });
      }
    }

    res.json({
      created,
      skipped,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to import taxonomy" });
  }
});

export default router;
