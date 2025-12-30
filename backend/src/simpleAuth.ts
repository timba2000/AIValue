import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "./db/client.js";
import { users, type UserRole } from "./db/schema.js";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
    role: UserRole;
  }
}

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionTtlMs = 1 * 24 * 60 * 60 * 1000; // 1 day in milliseconds (for cookie)
  const sessionTtlSeconds = sessionTtlMs / 1000; // 1 day in seconds (for pg store)
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtlMs,
      sameSite: "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Password not set for this account" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const role = (user.role as UserRole) || "reader";
      req.session.userId = user.id;
      req.session.isAdmin = role === "admin";
      req.session.role = role;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: role === "admin",
        role: role,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      
      if (existing && existing.password) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      if (existing && !existing.password) {
        await db
          .update(users)
          .set({
            password: hashedPassword,
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
        
        const existingRole = (existing.role as UserRole) || "reader";
        req.session.userId = existing.id;
        req.session.isAdmin = existingRole === "admin";
        req.session.role = existingRole;
        
        return res.json({
          id: existing.id,
          email: existing.email,
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          isAdmin: existingRole === "admin",
          role: existingRole,
        });
      }

      const [existingUsers] = await db.select({ count: users.id }).from(users);
      const isFirstUser = !existingUsers;
      const newRole: UserRole = isFirstUser ? "admin" : "reader";

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          isAdmin: isFirstUser ? 1 : 0,
          role: newRole,
        })
        .returning();

      req.session.userId = newUser.id;
      req.session.isAdmin = newRole === "admin";
      req.session.role = newRole;

      res.json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isAdmin: newRole === "admin",
        role: newRole,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const role = (user.role as UserRole) || "reader";
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: role === "admin",
        role: role,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const isAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};

export const isEditorOrAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const role = req.session.role || "reader";
  if (role !== "editor" && role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Editor or Admin access required" });
  }
  next();
};

export const requireRole = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const role = req.session.role || "reader";
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: `Forbidden: Requires ${allowedRoles.join(" or ")} role` });
    }
    next();
  };
};

export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
