/** Domain types come from the engine package; only the browser's own review types live here. */
export type {
  FraudReason,
  FraudResult,
  Location,
  RiskLevel,
  RuleConfig,
  RuleId,
  ScoredTransaction,
  Status,
  Transaction,
} from '@sentinel/engine';
export { RISK_LEVELS, RULE_IDS, STATUSES } from '@sentinel/engine';

export const VERDICTS = ['fraud', 'legitimate'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** An analyst's decision on one transaction, kept separately from the engine's score. */
export interface Review {
  verdict: Verdict;
  note: string;
  reviewedAt: string; // ISO timestamp of when the analyst saved it
}
