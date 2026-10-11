import type { Decision, Prisma, ReviewStatus, TxnType } from '@prisma/client';
import { RULE_IDS, type FraudReason, type RuleId, type ScoredTransaction } from '@sentinel/engine';
import { fromDbTime } from '../dbTime';

/**
 * A stored transaction as the API sends it: the engine's shape, so the web app can reuse
 * its views and helpers, plus what only stored data has.
 */
export interface ApiTransaction extends ScoredTransaction {
  txnType: TxnType;
  /** Masked, e.g. "024****601". */
  senderMsisdn: string;
  recipientMsisdn: string | null;
  agentId: string | null;
  reviewStatus: ReviewStatus;
  /** The most recent analyst decision, if any. Earlier ones stay in the history. */
  latestDecision: { decision: Decision; decidedAt: string } | null;
}

/** What every query for transactions loads alongside the row. */
export const TRANSACTION_INCLUDE = {
  reasons: { orderBy: { id: 'asc' } },
  decisions: {
    orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { decision: true, decidedAt: true },
  },
} satisfies Prisma.TransactionInclude;

type StoredTransaction = Prisma.TransactionGetPayload<{ include: typeof TRANSACTION_INCLUDE }>;

const isRuleId = (id: string): id is RuleId => (RULE_IDS as readonly string[]).includes(id);

export function toApiTransaction(row: StoredTransaction): ApiTransaction {
  const latest = row.decisions[0];
  return {
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
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    // A rule this version of the engine no longer knows is left out rather than mislabelled.
    fraudReasons: row.reasons.flatMap((r): FraudReason[] =>
      isRuleId(r.ruleId) ? [{ ruleId: r.ruleId, points: r.points, text: r.text }] : [],
    ),
    txnType: row.txnType,
    senderMsisdn: row.senderMsisdn,
    recipientMsisdn: row.recipientMsisdn,
    agentId: row.agentId,
    reviewStatus: row.reviewStatus,
    latestDecision: latest
      ? { decision: latest.decision, decidedAt: latest.decidedAt.toISOString() }
      : null,
  };
}
