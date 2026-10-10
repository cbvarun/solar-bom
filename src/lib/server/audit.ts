import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface Actor {
  userId: string | null;
  label: string;
  roles: string[];
}

export const ANONYMOUS: Actor = { userId: null, label: "Customer (website)", roles: [] };
export const SYSTEM: Actor = { userId: null, label: "System (calculation engine)", roles: [] };

export async function audit(
  db: Db,
  actor: Actor,
  entry: { entityType: string; entityId: string; action: string; field?: string; oldValue?: unknown; newValue?: unknown; reason?: string },
) {
  const str = (v: unknown) => (v === undefined ? null : v === null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
  await db.auditLog.create({
    data: {
      entityType: entry.entityType, entityId: entry.entityId, action: entry.action, field: entry.field ?? null,
      oldValue: str(entry.oldValue), newValue: str(entry.newValue), reason: entry.reason ?? null,
      userId: actor.userId, actorLabel: actor.label,
    },
  });
}
