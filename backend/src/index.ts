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
import { setupAuth, isAuthenticated, isAdmin, getUser } from "./replitAuth.js";

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

async function startServer() {
  await setupAuth(app);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await getUser(userId);
      const adminUserIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
      const isUserAdmin = adminUserIds.includes(userId);
      res.json({ ...user, isAdmin: isUserAdmin });
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.use("/usecases", useCaseRouter);
  app.use("/api/use-cases", useCaseRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/business-units", businessUnitsRouter);
  app.use("/api/processes", processesRouter);
  app.use("/api/pain-points", painPointsRouter);
  app.use("/api", painPointLinksRouter);
  app.use("/api/taxonomy", taxonomyRouter);

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db/client.js");
      const { companies, businessUnits, processes, painPoints, useCases, users } = await import("./db/schema.js");
      const { count } = await import("drizzle-orm");
      
      const [companiesCount] = await db.select({ count: count() }).from(companies);
      const [businessUnitsCount] = await db.select({ count: count() }).from(businessUnits);
      const [processesCount] = await db.select({ count: count() }).from(processes);
      const [painPointsCount] = await db.select({ count: count() }).from(painPoints);
      const [useCasesCount] = await db.select({ count: count() }).from(useCases);
      const [usersCount] = await db.select({ count: count() }).from(users);
      
      res.json({
        companies: companiesCount.count,
        businessUnits: businessUnitsCount.count,
        processes: processesCount.count,
        painPoints: painPointsCount.count,
        useCases: useCasesCount.count,
        users: usersCount.count
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
      
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const isProduction = process.env.NODE_ENV === "production";
  const frontendDistPath = isProduction 
    ? path.join(__dirname, "../public")
    : path.join(__dirname, "../../../frontend/dist");

  app.use(express.static(frontendDistPath));

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
