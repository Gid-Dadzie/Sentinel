import type { PrismaClient } from '@prisma/client';
import { RULE_IDS } from '@sentinel/engine';
import { Router } from 'express';
import { toEngineRules } from '../imports/score';

/** The rules as stored, in the engine's order. Read-only for now. Behind requireAuth. */
export function rulesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rules = toEngineRules(
      await prisma.rule.findMany({
        select: { id: true, name: true, condition: true, points: true, enabled: true },
      }),
    ).sort((a, b) => RULE_IDS.indexOf(a.id) - RULE_IDS.indexOf(b.id));
    res.json({ rules });
  });

  return router;
}
