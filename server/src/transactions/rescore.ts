import type { PrismaClient, RiskLevel } from '@prisma/client';
import {
  RISK_LEVELS,
  isFlagged,
  scoreAll,
  type RuleConfig,
  type ScoredTransaction,
  type Transaction,
} from '@sentinel/engine';
import { fromDbTime } from '../dbTime';

export interface RescoreSummary {
  total: number;
  /** Transactions whose score, level, status or reasons would change. */
  changed: number;
  flaggedBefore: number;
  flaggedAfter: number;
  newlyFlagged: number;
  noLongerFlagged: number;
  /** Counts per risk level, before and after. */
  levels: { level: RiskLevel; before: number; after: number }[];
  /** Transactions that would move between risk levels, largest moves first. */
  moves: { from: RiskLevel; to: RiskLevel; count: number }[];
}

export interface RescorePlan {
  summary: RescoreSummary;
  /** The new result for every transaction that changes. */
  changes: ScoredTransaction[];
}

type Reason = { ruleId: string; points: number; text: string };

const sameReasons = (a: readonly Reason[], b: readonly Reason[]) =>
  a.length === b.length &&
  a.every(
    (r, i) => r.ruleId === b[i]?.ruleId && r.points === b[i]?.points && r.text === b[i]?.text,
  );

/**
 * Scores every stored transaction again with the given rules, exactly as an import would
 * have (time order, each against its own account's earlier transactions), and works out
 * what would change. Stores nothing. Analyst decisions are not part of the score.
 */
export async function planRescore(
  prisma: PrismaClient,
  rules: readonly RuleConfig[],
): Promise<RescorePlan> {
  const rows = await prisma.transaction.findMany({
    include: { reasons: { orderBy: { id: 'asc' } } },
  });
  const transactions: Transaction[] = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    customerName: row.customerName,
    amount: row.amount.toNumber(),
    currency: row.currency,
    merchant: row.merchant,
    category: row.category,
    location: { city: row.city, country: row.country },
    timestamp: fromDbTime(row.timestamp),
    deviceId: row.deviceId,
    status: row.status,
  }));
  const before = new Map(rows.map((row) => [row.id, row]));
  const scored = scoreAll(transactions, rules);

  const levels = new Map(RISK_LEVELS.map((level) => [level, { before: 0, after: 0 }]));
  const moves = new Map<string, { from: RiskLevel; to: RiskLevel; count: number }>();
  const changes: ScoredTransaction[] = [];
  let flaggedBefore = 0;
  let flaggedAfter = 0;
  let newlyFlagged = 0;
  let noLongerFlagged = 0;

  for (const tx of scored) {
    const old = before.get(tx.id);
    if (!old) continue;
    const wasFlagged = isFlagged(old.riskScore);
    const nowFlagged = isFlagged(tx.riskScore);
    if (wasFlagged) flaggedBefore += 1;
    if (nowFlagged) flaggedAfter += 1;
    if (nowFlagged && !wasFlagged) newlyFlagged += 1;
    if (wasFlagged && !nowFlagged) noLongerFlagged += 1;
    const levelCount = (level: RiskLevel) => levels.get(level) ?? { before: 0, after: 0 };
    levelCount(old.riskLevel).before += 1;
    levelCount(tx.riskLevel).after += 1;
    if (old.riskLevel !== tx.riskLevel) {
      const key = `${old.riskLevel}>${tx.riskLevel}`;
      const move = moves.get(key) ?? { from: old.riskLevel, to: tx.riskLevel, count: 0 };
      move.count += 1;
      moves.set(key, move);
    }
    if (
      old.riskScore !== tx.riskScore ||
      old.status !== tx.status ||
      !sameReasons(old.reasons, tx.fraudReasons)
    ) {
      changes.push(tx);
    }
  }

  return {
    summary: {
      total: scored.length,
      changed: changes.length,
      flaggedBefore,
      flaggedAfter,
      newlyFlagged,
      noLongerFlagged,
      levels: RISK_LEVELS.map((level) => ({
        level,
        ...(levels.get(level) ?? { before: 0, after: 0 }),
      })),
      moves: [...moves.values()].sort((a, b) => b.count - a.count),
    },
    changes,
  };
}

const CHUNK = 500;

/** Saves the new scores and reasons in one database transaction. Decisions stay as they are. */
export async function applyRescore(
  prisma: PrismaClient,
  changes: readonly ScoredTransaction[],
): Promise<void> {
  await prisma.$transaction(
    async (db) => {
      for (let i = 0; i < changes.length; i += CHUNK) {
        const batch = changes.slice(i, i + CHUNK);
        const ids = batch.map((tx) => tx.id);
        await db.fraudReason.deleteMany({ where: { transactionId: { in: ids } } });
        await db.fraudReason.createMany({
          data: batch.flatMap((tx) =>
            tx.fraudReasons.map((r) => ({
              transactionId: tx.id,
              ruleId: r.ruleId,
              points: r.points,
              text: r.text,
            })),
          ),
        });
        for (const tx of batch) {
          await db.transaction.update({
            where: { id: tx.id },
            data: { riskScore: tx.riskScore, riskLevel: tx.riskLevel, status: tx.status },
          });
        }
      }
    },
    { timeout: 300_000 },
  );
}
