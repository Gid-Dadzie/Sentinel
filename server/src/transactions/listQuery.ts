import type { Prisma } from '@prisma/client';
import { RISK_LEVELS, STATUSES } from '@sentinel/engine';
import { z } from 'zod';
import { toDbTime } from '../dbTime';

/** Scores above this are flagged (medium risk or worse), as the engine's isFlagged says. */
export const FLAGGED: Prisma.TransactionWhereInput = { riskScore: { gt: 25 } };

/** Flagged and not resolved by an analyst yet: the review queue. */
export const NEEDS_REVIEW: Prisma.TransactionWhereInput = {
  ...FLAGGED,
  reviewStatus: { not: 'resolved' },
};

const flag = z.enum(['1']).optional();

/** The same filters, sorting and paging as the web app's table, read from the query string. */
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  risk: z.enum(RISK_LEVELS).optional(),
  status: z.enum(STATUSES).optional(),
  review: z.enum(['new', 'under_review', 'resolved']).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  min: z.coerce.number().positive().finite().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-09-15')
    .optional(),
  flagged: flag,
  needsReview: flag,
  sort: z.enum(['time', 'amount', 'score']).default('time'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function listWhere(query: ListQuery): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' } as const;
    and.push({
      OR: [
        { id: contains },
        { accountId: contains },
        { customerName: contains },
        { merchant: contains },
        { city: contains },
      ],
    });
  }
  if (query.risk) and.push({ riskLevel: query.risk });
  if (query.status) and.push({ status: query.status });
  if (query.review) and.push({ reviewStatus: query.review });
  if (query.country) and.push({ country: query.country });
  if (query.min !== undefined) and.push({ amount: { gte: query.min } });
  if (query.from) and.push({ timestamp: { gte: toDbTime(`${query.from}T00:00:00`) } });
  if (query.flagged) and.push(FLAGGED);
  if (query.needsReview) and.push(NEEDS_REVIEW);
  return and.length > 0 ? { AND: and } : {};
}

const SORT_FIELDS = { time: 'timestamp', amount: 'amount', score: 'riskScore' } as const;

/** Ties fall back to time, then ID, in the same direction, like the web app's sorting. */
export function listOrder(query: ListQuery): Prisma.TransactionOrderByWithRelationInput[] {
  const field = SORT_FIELDS[query.sort];
  const order: Prisma.TransactionOrderByWithRelationInput[] = [{ [field]: query.dir }];
  if (field !== 'timestamp') order.push({ timestamp: query.dir });
  order.push({ id: query.dir });
  return order;
}
