import { db } from "../db/client.js";
import { auditLogs, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export type EntityType = "pain_point" | "solution" | "company" | "business_unit" | "process" | "link";
export type ActionType = "create" | "update" | "delete";

interface AuditContext {
  userId?: string;
  userName?: string;
  ipAddress?: string;
}

interface ChangeDetail {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function getChanges(previousValues: Record<string, unknown>, newValues: Record<string, unknown>): ChangeDetail[] {
  const changes: ChangeDetail[] = [];
  const allKeys = new Set([...Object.keys(previousValues), ...Object.keys(newValues)]);
  
  for (const key of allKeys) {
    if (key === 'updatedAt' || key === 'createdAt' || key === 'id') continue;
    
    const oldVal = previousValues[key];
    const newVal = newValues[key];
    
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    
    if (oldStr !== newStr) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  }
  
  return changes;
}

export async function logCreate(
  entityType: EntityType,
  entityId: string,
  entityName: string | null,
  newValues: Record<string, unknown>,
  context: AuditContext
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: context.userId || null,
      userName: context.userName || null,
      entityType,
      entityId,
      entityName,
      action: "create",
      changes: null,
      previousValues: null,
      newValues: newValues,
      ipAddress: context.ipAddress || null
    });
  } catch (error) {
    console.error("Failed to log audit create:", error);
  }
}

export async function logUpdate(
  entityType: EntityType,
  entityId: string,
  entityName: string | null,
  previousValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  context: AuditContext
): Promise<void> {
  try {
    const changes = getChanges(previousValues, newValues);
    
    if (changes.length === 0) return;
    
    await db.insert(auditLogs).values({
      userId: context.userId || null,
      userName: context.userName || null,
      entityType,
      entityId,
      entityName,
      action: "update",
      changes: changes,
      previousValues: previousValues,
      newValues: newValues,
      ipAddress: context.ipAddress || null
    });
  } catch (error) {
    console.error("Failed to log audit update:", error);
  }
}

export async function logDelete(
  entityType: EntityType,
  entityId: string,
  entityName: string | null,
  previousValues: Record<string, unknown>,
  context: AuditContext
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: context.userId || null,
      userName: context.userName || null,
      entityType,
      entityId,
      entityName,
      action: "delete",
      changes: null,
      previousValues: previousValues,
      newValues: null,
      ipAddress: context.ipAddress || null
    });
  } catch (error) {
    console.error("Failed to log audit delete:", error);
  }
}

export async function getAuditContext(req: { session?: { userId?: string }; ip?: string }): Promise<AuditContext> {
  let userName = 'Unknown';
  let userId: string | undefined;
  
  if (req.session?.userId) {
    userId = req.session.userId;
    try {
      const [user] = await db.select({ 
        firstName: users.firstName, 
        lastName: users.lastName, 
        email: users.email 
      }).from(users).where(eq(users.id, req.session.userId));
      if (user) {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        userName = fullName || user.email || 'Unknown';
      }
    } catch (error) {
      console.error("Failed to fetch user for audit context:", error);
    }
  }
  
  return {
    userId,
    userName,
    ipAddress: req.ip
  };
}
