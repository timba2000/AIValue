import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/client.js";
import { aiFileUploads } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getUser } from "../simpleAuth.js";
import { 
  processFile, 
  isAllowedMimeType, 
  isFileSizeValid, 
  getFileTypeDescription,
  isImageFile
} from "../services/fileProcessingService.js";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "ai");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (
  _req: Request, 
  file: Express.Multer.File, 
  cb: multer.FileFilterCallback
) => {
  if (isAllowedMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5
  }
});

router.post("/", upload.array("files", 5), async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const conversationId = req.body.conversationId || null;
    const uploadResults = [];

    for (const file of files) {
      if (!isFileSizeValid(file.size)) {
        fs.unlinkSync(file.path);
        continue;
      }

      const processingResult = await processFile(file.path, file.mimetype);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const [uploadRecord] = await db.insert(aiFileUploads).values({
        conversationId,
        userId: user.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: file.path,
        extractedText: processingResult.extractedText || null,
        processingStatus: processingResult.success ? "completed" : "failed",
        expiresAt
      }).returning();

      uploadResults.push({
        id: uploadRecord.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileType: getFileTypeDescription(file.mimetype),
        isImage: isImageFile(file.mimetype),
        processingStatus: uploadRecord.processingStatus,
        extractedText: processingResult.extractedText?.substring(0, 500),
        base64Preview: processingResult.isImage ? processingResult.base64Data : undefined
      });
    }

    res.json({
      success: true,
      uploads: uploadResults
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ 
      error: "Failed to upload files",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;

    const [upload] = await db.select()
      .from(aiFileUploads)
      .where(and(
        eq(aiFileUploads.id, id),
        eq(aiFileUploads.userId, user.id)
      ));

    if (!upload) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(upload);
  } catch (error) {
    console.error("Error fetching upload:", error);
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

router.get("/:id/download", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;

    const [upload] = await db.select()
      .from(aiFileUploads)
      .where(and(
        eq(aiFileUploads.id, id),
        eq(aiFileUploads.userId, user.id)
      ));

    if (!upload) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!fs.existsSync(upload.storagePath)) {
      return res.status(404).json({ error: "File no longer exists" });
    }

    res.download(upload.storagePath, upload.originalName);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { id } = req.params;

    const [upload] = await db.select()
      .from(aiFileUploads)
      .where(and(
        eq(aiFileUploads.id, id),
        eq(aiFileUploads.userId, user.id)
      ));

    if (!upload) {
      return res.status(404).json({ error: "File not found" });
    }

    if (fs.existsSync(upload.storagePath)) {
      fs.unlinkSync(upload.storagePath);
    }

    await db.delete(aiFileUploads).where(eq(aiFileUploads.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
