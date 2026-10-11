import type { Prisma, PrismaClient } from '@prisma/client';

export interface AuditEntry {
  actorId: string | null;
  action: string; // "login", "login.failed", "logout", "user.create", ...
  entity: string;
  entityId?: string;
  detail?: Prisma.InputJsonObject;
}

/**
 * Appends to the audit log. Entries are never updated or deleted. Pass a transaction's
 * client to record the entry together with the change it describes.
 */
export async function audit(
  prisma: Pick<PrismaClient, 'auditLog'>,
  entry: AuditEntry,
): Promise<void> {
  await prisma.auditLog.create({ data: entry });
}
