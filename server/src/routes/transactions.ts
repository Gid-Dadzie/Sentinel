import type { Decision, PrismaClient, ReviewStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth/middleware';
import { HttpError, parseBody, parseQuery } from '../http';
import { clearTransactions } from '../transactions/clear';
import { listOrder, listQuerySchema, listWhere } from '../transactions/listQuery';
import { TRANSACTION_INCLUDE, toApiTransaction } from '../transactions/serialize';

export const MAX_NOTES = 2000;

const decisionSchema = z.object({
  decision: z.enum(['confirmed_fraud', 'false_positive', 'needs_info']),
  notes: z
    .string()
    .trim()
    .min(1, 'add a note explaining the decision')
    .max(MAX_NOTES, `must be at most ${MAX_NOTES} characters`),
});

/**
 * Where a decision leaves the review: asking for more information keeps it open, a
 * verdict closes it. The latest decision always wins; earlier ones are kept.
 */
const REVIEW_STATUS_AFTER: Record<Decision, ReviewStatus> = {
  needs_info: 'under_review',
  confirmed_fraud: 'resolved',
  false_positive: 'resolved',
};

const decisionSelect = {
  id: true,
  decision: true,
  notes: true,
  decidedAt: true,
  analyst: { select: { id: true, name: true } },
} as const;

/** Sent with DELETE /api/transactions so a stray request cannot empty the database. */
const clearSchema = z.object({ confirm: z.literal('delete all transactions') }).strict();

/**
 * Stored transactions and analyst decisions. Analysts and admins; clearing everything is
 * for admins. Behind requireAuth.
 */
export function transactionsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseQuery(req, listQuerySchema);
    const where = listWhere(query);
    const total = await prisma.transaction.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: listOrder(query),
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      include: TRANSACTION_INCLUDE,
    });
    res.json({ items: rows.map(toApiTransaction), total, page, pageCount });
  });

  /**
   * Deletes every stored transaction, with its reasons and decisions, to start again with
   * a fresh import. Users, rules and the audit log are kept; the clearing is audited.
   */
  router.delete('/', requireRole('admin'), async (req, res) => {
    parseBody(req, clearSchema);
    res.json({ deleted: await clearTransactions(prisma, res.locals.user.id) });
  });

  /** The transaction and every decision on it, newest first. */
  router.get('/:id', async (req, res) => {
    const row = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: TRANSACTION_INCLUDE,
    });
    if (!row) throw new HttpError(404, 'Transaction not found');
    const decisions = await prisma.analystDecision.findMany({
      where: { transactionId: row.id },
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
      select: decisionSelect,
    });
    res.json({
      transaction: toApiTransaction(row),
      decisions: decisions.map((d) => ({ ...d, decidedAt: d.decidedAt.toISOString() })),
    });
  });

  /** Adds a decision. Never edits or removes an earlier one. */
  router.post('/:id/decisions', async (req, res) => {
    const { decision, notes } = parseBody(req, decisionSchema);
    const actorId = res.locals.user.id;
    const reviewStatus = REVIEW_STATUS_AFTER[decision];

    const saved = await prisma.$transaction(async (tx) => {
      const found = await tx.transaction.findUnique({
        where: { id: req.params.id },
        select: { id: true, reviewStatus: true },
      });
      if (!found) throw new HttpError(404, 'Transaction not found');
      const created = await tx.analystDecision.create({
        data: { transactionId: found.id, analystId: actorId, decision, notes },
        select: decisionSelect,
      });
      await tx.transaction.update({ where: { id: found.id }, data: { reviewStatus } });
      await audit(tx, {
        actorId,
        action: 'decision',
        entity: 'transaction',
        entityId: found.id,
        detail: { decision, from: found.reviewStatus, to: reviewStatus },
      });
      return created;
    });

    res.status(201).json({
      decision: { ...saved, decidedAt: saved.decidedAt.toISOString() },
      reviewStatus,
    });
  });

  return router;
}
