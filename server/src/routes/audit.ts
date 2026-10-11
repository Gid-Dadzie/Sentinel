import type { Prisma, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { parseQuery } from '../http';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-10-05');

const auditQuerySchema = z.object({
  action: z.string().trim().min(1).max(50).optional(),
  actor: z.string().uuid().optional(),
  from: date.optional(),
  to: date.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const DAY_MS = 86_400_000;

/** The audit log, newest first. Read-only: nothing can change or remove entries. Admins only. */
export function auditRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireRole('admin'));

  router.get('/', async (req, res) => {
    const query = parseQuery(req, auditQuerySchema);
    // Dates are whole days in UTC; "to" includes the whole of that day.
    const at: Prisma.DateTimeFilter = {};
    if (query.from) at.gte = new Date(`${query.from}T00:00:00Z`);
    if (query.to) at.lt = new Date(new Date(`${query.to}T00:00:00Z`).getTime() + DAY_MS);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action && { action: query.action }),
      ...(query.actor && { actorId: query.actor }),
      ...((query.from ?? query.to) && { at }),
    };

    const [total, actions, actorIds] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
      prisma.auditLog.groupBy({ by: ['actorId'], where: { actorId: { not: null } } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const [rows, actors] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.user.findMany({
        where: { id: { in: actorIds.flatMap((a) => (a.actorId ? [a.actorId] : [])) } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      entries: rows.map((row) => ({
        id: row.id.toString(),
        at: row.at.toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        detail: row.detail,
        actor: row.actor,
      })),
      total,
      page,
      pageCount,
      filters: { actions: actions.map((a) => a.action), actors },
    });
  });

  return router;
}
