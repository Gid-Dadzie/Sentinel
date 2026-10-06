import { DEFAULT_RULES, scoreAll } from '../engine';
import {
  RULE_IDS,
  type RuleConfig,
  type RuleId,
  type ScoredTransaction,
  type Transaction,
} from '../types';
import { summarize, type DashboardSummary } from './dashboard';

/** The default rule, for comparing and showing "Default: 25". */
export function getDefaultRule(id: RuleId): RuleConfig | undefined {
  return DEFAULT_RULES.find((rule) => rule.id === id);
}

export function isRuleModified(rule: RuleConfig): boolean {
  const original = getDefaultRule(rule.id);
  return !original || original.points !== rule.points || original.enabled !== rule.enabled;
}

/**
 * How many transactions each rule fires on. A rule's check depends only on the
 * transaction and its history, never on other rules or on points, so scoring
 * once with every rule enabled gives the count for each rule, even disabled ones.
 */
export function triggerCounts(raw: readonly Transaction[]): Record<RuleId, number> {
  const allOn = DEFAULT_RULES.map((rule) => ({ ...rule, enabled: true }));
  const counts = Object.fromEntries(RULE_IDS.map((id) => [id, 0])) as Record<RuleId, number>;
  for (const tx of scoreAll(raw, allOn)) {
    for (const reason of tx.fraudReasons) counts[reason.ruleId] += 1;
  }
  return counts;
}

export interface ImpactRow {
  label: string;
  current: number;
  baseline: number;
}

/** Flagged / pending / declined now versus under the default rules. */
export function compareToDefaults(
  current: readonly ScoredTransaction[],
  baseline: readonly ScoredTransaction[],
): ImpactRow[] {
  const now = summarize(current);
  const before = summarize(baseline);
  const rows: [string, keyof DashboardSummary][] = [
    ['Flagged', 'flagged'],
    ['Pending review', 'pending'],
    ['Declined', 'declined'],
  ];
  return rows.map(([label, key]) => ({ label, current: now[key], baseline: before[key] }));
}

/** "+3", "−2" (true minus sign) or "no change". */
export function formatDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  if (delta === 0) return 'no change';
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
