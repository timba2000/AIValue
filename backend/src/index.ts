import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import useCaseRouter from "./routes/useCases.js";
import companiesRouter from "./routes/companies.js";
import businessUnitsRouter from "./routes/businessUnits.js";
import processesRouter from "./routes/processes.js";
import painPointsRouter from "./routes/painPoints.js";
import painPointLinksRouter from "./routes/painPointLinks.js";
import taxonomyRouter from "./routes/taxonomy.js";
import adminPainPointUploadRouter from "./routes/adminPainPointUpload.js";
import adminTaxonomyRouter from "./routes/adminTaxonomy.js";
import adminProcessUploadRouter from "./routes/adminProcessUpload.js";
import adminBusinessRouter from "./routes/adminBusiness.js";
import aiRouter from "./routes/ai.js";
import { setupAuth, isAuthenticated, isAdmin, getUser } from "./simpleAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? ["http://localhost:5000", "http://127.0.0.1:5000"],
    credentials: true
  })
);
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
const frontendDistPath = isProduction 
  ? path.join(__dirname, "../public")
  : path.join(__dirname, "../../../frontend/dist");

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(frontendDistPath));

async function startServer() {
  await setupAuth(app);

  app.use("/usecases", isAuthenticated, useCaseRouter);
  app.use("/api/use-cases", isAuthenticated, useCaseRouter);
  app.use("/api/companies", isAuthenticated, companiesRouter);
  app.use("/api/business-units", isAuthenticated, businessUnitsRouter);
  app.use("/api/processes", isAuthenticated, processesRouter);
  app.use("/api/pain-points", isAuthenticated, painPointsRouter);
  app.use("/api", isAuthenticated, painPointLinksRouter);
  app.use("/api/taxonomy", isAuthenticated, taxonomyRouter);
  app.use("/api/admin/pain-points", isAuthenticated, isAdmin, adminPainPointUploadRouter);
  app.use("/api/admin/taxonomy", isAuthenticated, isAdmin, adminTaxonomyRouter);
  app.use("/api/admin/processes", isAuthenticated, isAdmin, adminProcessUploadRouter);
  app.use("/api/admin/business", isAuthenticated, isAdmin, adminBusinessRouter);
  app.use("/api/ai", isAuthenticated, aiRouter);

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { companies, businessUnits, processes, painPoints, useCases, users, taxonomyCategories } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [companiesCount] = await db.select({ count: count() }).from(companies);
      const [businessUnitsCount] = await db.select({ count: count() }).from(businessUnits);
      const [processesCount] = await db.select({ count: count() }).from(processes);
      const [painPointsCount] = await db.select({ count: count() }).from(painPoints);
      const [useCasesCount] = await db.select({ count: count() }).from(useCases);
      const [usersCount] = await db.select({ count: count() }).from(users);
      const [taxonomyCount] = await db.select({ count: count() }).from(taxonomyCategories);
      
      res.json({
        companies: companiesCount.count,
        businessUnits: businessUnitsCount.count,
        processes: processesCount.count,
        painPoints: painPointsCount.count,
        useCases: useCasesCount.count,
        users: usersCount.count,
        taxonomy: taxonomyCount.count
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });
  
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { users } = await import("./db/schema.js");
      const { desc } = await import("drizzle-orm");
      
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt
      }).from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin: newAdminStatus } = req.body;
      
      if (typeof newAdminStatus !== "boolean") {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }
      
      const { db } = await import("./db/client.js");
      const { users } = await import("./db/schema.js");
      const { eq } = await import("drizzle-orm");
      
      const [updated] = await db
        .update(users)
        .set({ isAdmin: newAdminStatus ? 1 : 0, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ id: updated.id, email: updated.email, isAdmin: updated.isAdmin === 1 });
    } catch {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/delete/companies", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { companies } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [beforeCount] = await db.select({ count: count() }).from(companies);
      await db.delete(companies);
      
      res.json({ deleted: beforeCount.count, message: "All companies deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete companies" });
    }
  });

  app.delete("/api/admin/delete/taxonomy", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { taxonomyCategories } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [beforeCount] = await db.select({ count: count() }).from(taxonomyCategories);
      await db.delete(taxonomyCategories);
      
      res.json({ deleted: beforeCount.count, message: "All taxonomy categories deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete taxonomy" });
    }
  });

  app.delete("/api/admin/delete/processes", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { processes } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [beforeCount] = await db.select({ count: count() }).from(processes);
      await db.delete(processes);
      
      res.json({ deleted: beforeCount.count, message: "All processes deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete processes" });
    }
  });

  app.delete("/api/admin/delete/pain-points", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { painPoints } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [beforeCount] = await db.select({ count: count() }).from(painPoints);
      await db.delete(painPoints);
      
      res.json({ deleted: beforeCount.count, message: "All pain points deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete pain points" });
    }
  });

  app.delete("/api/admin/delete/use-cases", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { useCases } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [beforeCount] = await db.select({ count: count() }).from(useCases);
      await db.delete(useCases);
      
      res.json({ deleted: beforeCount.count, message: "All solutions deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete solutions" });
    }
  });

  app.delete("/api/admin/delete/all", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { companies, taxonomyCategories, painPoints, useCases } = await import("./db/schema.js");
      
      await db.delete(painPoints);
      await db.delete(useCases);
      await db.delete(companies);
      await db.delete(taxonomyCategories);
      
      res.json({ message: "All data deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete all data" });
    }
  });

  app.get("*", (_req, res, next) => {
    if (_req.path.startsWith("/api") || _req.path.startsWith("/usecases") || _req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });
}

startServer().catch(console.error);
