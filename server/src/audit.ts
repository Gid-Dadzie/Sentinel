import type { Prisma, PrismaClient } from '@prisma/client';

export interface AuditEntry {
  actorId: string | null;
  action: string; // "login", "login.failed", "logout", "user.create", ...
  entity: string;
  entityId?: string;
  detail?: Prisma.InputJsonObject;
}

/** Appends to the audit log. Entries are never updated or deleted. */
export async function audit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({ data: entry });
}
