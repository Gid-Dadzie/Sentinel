import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { HttpError } from '../http';
import { TRANSACTION_INCLUDE, toApiTransaction } from '../transactions/serialize';

/** One account's transactions, oldest first, for its profile. Behind requireAuth. */
export function customersRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/:accountId', async (req, res) => {
    const rows = await prisma.transaction.findMany({
      where: { accountId: req.params.accountId },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      include: TRANSACTION_INCLUDE,
    });
    if (rows.length === 0) throw new HttpError(404, 'Customer not found');
    res.json({ accountId: req.params.accountId, transactions: rows.map(toApiTransaction) });
  });

  return router;
}
