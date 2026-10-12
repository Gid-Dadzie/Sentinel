import type { PrismaClient } from '@prisma/client';

export interface ClearResult {
  transactions: number;
  decisions: number;
}

/**
 * Removes every stored transaction with its reasons and analyst decisions, so a fresh
 * file can be imported. Users, rules and the audit log are kept, and the clearing is
 * itself recorded in the audit log, in the same database transaction.
 */
export async function clearTransactions(
  prisma: PrismaClient,
  actorId: string | null,
): Promise<ClearResult> {
  return prisma.$transaction(async (db) => {
    const decisions = (await db.analystDecision.deleteMany()).count;
    await db.fraudReason.deleteMany();
    const transactions = (await db.transaction.deleteMany()).count;
    await db.auditLog.create({
      data: {
        actorId,
        action: 'transactions.clear',
        entity: 'transaction',
        detail: { transactions, decisions },
      },
    });
    return { transactions, decisions };
  });
}
