import type { Prisma, PrismaClient } from '@prisma/client';
import { RISK_LEVELS } from '@sentinel/engine';
import { Router } from 'express';
import { FLAGGED, NEEDS_REVIEW } from '../transactions/listQuery';
import { TRANSACTION_INCLUDE, toApiTransaction } from '../transactions/serialize';

/** How many queue items the dashboard shows; the full queue is a filter on the table. */
const QUEUE_SIZE = 6;

const sum = (value: Prisma.Decimal | null) => value?.toNumber() ?? 0;

/**
 * Everything the dashboard shows above the table, worked out in the database so it stays
 * quick however many transactions are stored. Behind requireAuth.
 */
export function dashboardRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const [all, flagged, byStatus, byLevel, needsReview, queue, daily, countries] =
      await Promise.all([
        prisma.transaction.aggregate({ _count: true, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: FLAGGED, _count: true, _sum: { amount: true } }),
        prisma.transaction.groupBy({ by: ['status'], _count: true }),
        prisma.transaction.groupBy({ by: ['riskLevel'], _count: true }),
        prisma.transaction.count({ where: NEEDS_REVIEW }),
        prisma.transaction.findMany({
          where: NEEDS_REVIEW,
          orderBy: [{ riskScore: 'desc' }, { timestamp: 'desc' }, { id: 'desc' }],
          take: QUEUE_SIZE,
          include: TRANSACTION_INCLUDE,
        }),
        prisma.$queryRaw<{ date: string; total: number; flagged: number }[]>`
          SELECT to_char(timestamp, 'YYYY-MM-DD') AS date,
                 count(*)::int AS total,
                 (count(*) FILTER (WHERE risk_score > 25))::int AS flagged
          FROM transactions
          GROUP BY 1
          ORDER BY 1`,
        prisma.transaction.groupBy({ by: ['country'], orderBy: { country: 'asc' } }),
      ]);

    const statusCount = (status: string) => byStatus.find((s) => s.status === status)?._count ?? 0;
    res.json({
      summary: {
        total: all._count,
        flagged: flagged._count,
        declined: statusCount('declined'),
        pending: statusCount('pending'),
        totalAmount: sum(all._sum.amount),
        flaggedAmount: sum(flagged._sum.amount),
      },
      byLevel: RISK_LEVELS.map((level) => ({
        level,
        count: byLevel.find((l) => l.riskLevel === level)?._count ?? 0,
      })),
      daily,
      needsReview,
      queue: queue.map(toApiTransaction),
      countries: countries.map((c) => c.country),
    });
  });

  return router;
}
