import type { RuleConfig, ScoredTransaction, Transaction } from './types';
import { calculateFraudRisk } from './calculateFraudRisk';
import { getRiskLevel, getStatus } from './riskLevel';

/** Timestamps share one fixed format, so string order is chronological order. */
export function compareChronological(a: Transaction, b: Transaction): number {
  return a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id);
}

/**
 * Scores every transaction in chronological order. Each one sees only its own
 * account's earlier transactions. Ties on timestamp are ordered by ID.
 * Returns new objects in chronological order; the input is not mutated.
 */
export function scoreAll(
  transactions: readonly Transaction[],
  rules: readonly RuleConfig[],
): ScoredTransaction[] {
  const historyByAccount = new Map<string, Transaction[]>();

  return [...transactions].sort(compareChronological).map((tx) => {
    let history = historyByAccount.get(tx.accountId);
    if (!history) {
      history = [];
      historyByAccount.set(tx.accountId, history);
    }
    const { score, reasons } = calculateFraudRisk(tx, history, rules);
    history.push(tx); // safe: the engine has already returned and keeps no reference
    return {
      ...tx,
      riskScore: score,
      riskLevel: getRiskLevel(score),
      status: getStatus(score),
      fraudReasons: reasons,
    };
  });
}
