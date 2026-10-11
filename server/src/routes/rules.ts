import type { PrismaClient } from '@prisma/client';
import { MAX_POINTS, MIN_POINTS, RULE_IDS, type RuleConfig } from '@sentinel/engine';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth/middleware';
import { HttpError, parseBody } from '../http';
import { toEngineRules } from '../imports/score';
import { applyRescore, planRescore } from '../transactions/rescore';

/** The stored rules this engine knows, in the engine's order, with only their settings. */
export async function loadRules(prisma: PrismaClient): Promise<RuleConfig[]> {
  const rows = await prisma.rule.findMany({
    select: { id: true, name: true, condition: true, points: true, enabled: true },
  });
  return toEngineRules(rows).sort((a, b) => RULE_IDS.indexOf(a.id) - RULE_IDS.indexOf(b.id));
}

const ruleUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    points: z.number().int().min(MIN_POINTS).max(MAX_POINTS).optional(),
  })
  .strict()
  .refine((patch) => patch.enabled !== undefined || patch.points !== undefined, {
    message: 'change enabled, points or both',
  });

interface FeedbackRow {
  ruleId: string;
  fired: number;
  confirmedFraud: number;
  falsePositive: number;
}

/**
 * Rules and how they perform against analyst verdicts. Everyone signed in can read;
 * changing rules is for admins. Behind requireAuth.
 */
export function rulesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ rules: await loadRules(prisma) });
  });

  /**
   * Per rule: how many stored transactions it fired on, and how those were judged in their
   * latest analyst decision. A rule that mostly fires on false positives is a candidate
   * for fewer points.
   */
  router.get('/feedback', async (_req, res) => {
    const rows = await prisma.$queryRaw<FeedbackRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (transaction_id) transaction_id, decision
        FROM decisions
        ORDER BY transaction_id, decided_at DESC, id DESC
      )
      SELECT r.rule_id AS "ruleId",
             count(*)::int AS fired,
             (count(*) FILTER (WHERE l.decision = 'confirmed_fraud'))::int AS "confirmedFraud",
             (count(*) FILTER (WHERE l.decision = 'false_positive'))::int AS "falsePositive"
      FROM fraud_reasons r
      LEFT JOIN latest l ON l.transaction_id = r.transaction_id
      GROUP BY r.rule_id`;
    const byRule = new Map(rows.map((row) => [row.ruleId, row]));
    res.json({
      feedback: RULE_IDS.map((ruleId) => ({
        ruleId,
        fired: byRule.get(ruleId)?.fired ?? 0,
        confirmedFraud: byRule.get(ruleId)?.confirmedFraud ?? 0,
        falsePositive: byRule.get(ruleId)?.falsePositive ?? 0,
      })),
    });
  });

  /** Changes a rule's switch or points. New imports use it at once; stored scores do not change. */
  router.patch('/:id', requireRole('admin'), async (req, res) => {
    const patch = parseBody(req, ruleUpdateSchema);
    const actorId = res.locals.user.id;
    const rule = await prisma.$transaction(async (tx) => {
      const before = await tx.rule.findUnique({ where: { id: String(req.params.id) } });
      if (!before) throw new HttpError(404, 'Rule not found');
      const after = await tx.rule.update({
        where: { id: before.id },
        data: { ...patch, updatedById: actorId },
        select: { id: true, name: true, condition: true, points: true, enabled: true },
      });
      await audit(tx, {
        actorId,
        action: 'rule.update',
        entity: 'rule',
        entityId: before.id,
        detail: {
          before: { points: before.points, enabled: before.enabled },
          after: { points: after.points, enabled: after.enabled },
        },
      });
      return after;
    });
    res.json({ rule });
  });

  return router;
}

/** Re-scores stored transactions with the current rules. Admins only; behind requireAuth. */
export function rescoreRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireRole('admin'));

  /** What a re-score would change. Stores nothing. */
  router.get('/', async (_req, res) => {
    const { summary } = await planRescore(prisma, await loadRules(prisma));
    res.json({ summary });
  });

  /** Re-scores and saves. Analyst decisions and review statuses are left as they are. */
  router.post('/', async (_req, res) => {
    const rules = await loadRules(prisma);
    const { summary, changes } = await planRescore(prisma, rules);
    await applyRescore(prisma, changes);
    await audit(prisma, {
      actorId: res.locals.user.id,
      action: 'rescore',
      entity: 'transaction',
      detail: {
        total: summary.total,
        changed: summary.changed,
        flaggedBefore: summary.flaggedBefore,
        flaggedAfter: summary.flaggedAfter,
        rules: rules.map(({ id, points, enabled }) => ({ id, points, enabled })),
      },
    });
    res.json({ summary });
  });

  return router;
}
