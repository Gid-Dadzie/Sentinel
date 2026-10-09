import { compareChronological } from '@sentinel/engine';
import type { FraudReason, RuleConfig, ScoredTransaction, Verdict } from '../types';

export const VERDICT_LABELS: Record<Verdict, string> = {
  fraud: 'Confirmed fraud',
  legitimate: 'Legitimate (false positive)',
};

/** Compact form for table cells. */
export const VERDICT_SHORT_LABELS: Record<Verdict, string> = {
  fraud: 'Reviewed: fraud',
  legitimate: 'Reviewed: legitimate',
};

export interface AccountBaseline {
  /** Same account, strictly earlier, oldest first: exactly what the engine saw. */
  history: ScoredTransaction[];
  /** Null when there is no history to average. */
  averageAmount: number | null;
  knownCountries: string[];
  knownDevices: string[];
  previous: ScoredTransaction | undefined;
  /** False when this transaction's country / device was new to the account. */
  countryKnown: boolean;
  deviceKnown: boolean;
}

/** Rebuilds the account context the engine used to score `tx`. */
export function getAccountBaseline(
  transactions: readonly ScoredTransaction[],
  tx: ScoredTransaction,
): AccountBaseline {
  const history = transactions
    .filter((other) => other.accountId === tx.accountId && compareChronological(other, tx) < 0)
    .sort(compareChronological);
  const knownCountries = [...new Set(history.map((h) => h.location.country))];
  const knownDevices = [...new Set(history.map((h) => h.deviceId))];
  return {
    history,
    averageAmount:
      history.length === 0 ? null : history.reduce((sum, h) => sum + h.amount, 0) / history.length,
    knownCountries,
    knownDevices,
    previous: history[history.length - 1],
    countryKnown: knownCountries.includes(tx.location.country),
    deviceKnown: knownDevices.includes(tx.deviceId),
  };
}

export type RuleOutcome =
  | { state: 'triggered'; rule: RuleConfig; reason: FraudReason }
  | { state: 'clear'; rule: RuleConfig }
  | { state: 'disabled'; rule: RuleConfig };

/** Every rule in rule order with what it did to this transaction; triggered rules first. */
export function getRuleOutcomes(
  rules: readonly RuleConfig[],
  reasons: readonly FraudReason[],
): RuleOutcome[] {
  const outcomes = rules.map((rule): RuleOutcome => {
    if (!rule.enabled) return { state: 'disabled', rule };
    const reason = reasons.find((r) => r.ruleId === rule.id);
    return reason ? { state: 'triggered', rule, reason } : { state: 'clear', rule };
  });
  const rank = { triggered: 0, clear: 1, disabled: 2 } as const;
  return outcomes.sort((a, b) => rank[a.state] - rank[b.state]); // stable: keeps rule order
}

/** Sum of triggered points before the 100 cap, to explain a capped score. */
export function uncappedTotal(reasons: readonly FraudReason[]): number {
  return reasons.reduce((sum, reason) => sum + reason.points, 0);
}
