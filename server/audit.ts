import type { InsertAuditLog } from "@shared/schema";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";

type AuditDetails = Record<string, unknown> | undefined;

export interface AuditEvent {
  userId?: string;
  entityType: string;
  entityId: string;
  actionType: AuditAction;
  details?: AuditDetails;
}

export async function logAuditEvent(
  event: AuditEvent,
  storageClient?: { createAuditLog: (data: InsertAuditLog) => Promise<unknown> },
): Promise<void> {
  const auditStorage =
    storageClient ?? (await import("./storage")).storage;

  const payload: InsertAuditLog = {
    userId: event.userId,
    entityType: event.entityType,
    entityId: event.entityId,
    actionType: event.actionType,
    details: event.details,
  };

  try {
    await auditStorage.createAuditLog(payload);
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
