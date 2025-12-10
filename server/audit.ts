codex/add-audit-logging-for-write-operations
import { storage } from "./storage";
import type { InsertAuditLog } from "@shared/schema";

export type AuditActionType = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
export type AuditEntityType = "SHIPMENT" | "PAYMENT" | "EXCHANGE_RATE" | "USER";

interface AuditEvent {
  userId?: string | null;
  entityType: AuditEntityType;
  entityId: string | number;
  actionType: AuditActionType;
  details?: unknown;
}

function serializeDetails(details: unknown) {
  if (details === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(details));
  } catch (error) {
    console.error("Failed to serialize audit log details", error);
    return { error: "Unable to serialize details" };
  }
}

export function logAuditEvent(event: AuditEvent): void {
  const payload: InsertAuditLog = {
    userId: event.userId || null,
    entityType: event.entityType,
    entityId: String(event.entityId),
    actionType: event.actionType,
    details: serializeDetails(event.details),
  };

  void storage.createAuditLog(payload).catch((error) => {
    console.error("Failed to write audit log", { error, payload });
  });
=======
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
main
}
