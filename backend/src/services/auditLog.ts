import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";

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

export function getAuditContext(req: { user?: { id?: string; claims?: { first_name?: string; last_name?: string } }; ip?: string }): AuditContext {
  const userName = req.user?.claims 
    ? `${req.user.claims.first_name || ''} ${req.user.claims.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown';
  
  return {
    userId: req.user?.id,
    userName,
    ipAddress: req.ip
  };
}
