import { filtersToParams, type TableFilters } from '../utils/dashboard';
import { apiFetch, json } from './client';
import type { ApiTransaction, DecisionEntry, DecisionKind, ReviewStatus } from './types';

export const DECISION_LABELS: Record<DecisionKind, string> = {
  confirmed_fraud: 'Confirmed fraud',
  false_positive: 'False positive',
  needs_info: 'Needs more information',
};

/** Compact form for table cells and lists. */
export const DECISION_SHORT_LABELS: Record<DecisionKind, string> = {
  confirmed_fraud: 'Reviewed: fraud',
  false_positive: 'Reviewed: false positive',
  needs_info: 'Under review: needs info',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  new: 'New',
  under_review: 'Under review',
  resolved: 'Resolved',
};

/** The table's URL filters (same names as the API's) as the list endpoint's path. */
export function transactionsPath(
  filters: TableFilters,
  pageSize: number,
  extra: Record<string, string> = {},
): string {
  const params = filtersToParams(filters);
  params.set('sort', filters.sort);
  params.set('dir', filters.dir);
  params.set('pageSize', String(pageSize));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/api/transactions?${params.toString()}`;
}

export interface SavedDecision {
  decision: DecisionEntry;
  reviewStatus: ReviewStatus;
}

/** Adds a decision; earlier ones are kept. */
export function saveDecision(
  transactionId: string,
  decision: DecisionKind,
  notes: string,
): Promise<SavedDecision> {
  return apiFetch(
    `/api/transactions/${encodeURIComponent(transactionId)}/decisions`,
    json('POST', { decision, notes }),
  );
}

/** Each transaction's latest decision as a short label for tables and lists. */
export function decisionLabels(transactions: readonly ApiTransaction[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const tx of transactions) {
    if (tx.latestDecision) labels[tx.id] = DECISION_SHORT_LABELS[tx.latestDecision.decision];
  }
  return labels;
}
