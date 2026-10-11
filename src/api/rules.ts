import type { RuleConfig } from '../types';
import type { RulePatch } from '../state/useFraudStore';
import { apiFetch, json } from './client';
import type { RescoreSummary } from './types';

/** Saves one rule's switch and points. New imports use it straight away. */
export function saveRule(id: RuleConfig['id'], patch: RulePatch): Promise<{ rule: RuleConfig }> {
  return apiFetch(`/api/rules/${encodeURIComponent(id)}`, json('PATCH', patch));
}

/** What re-scoring with the current rules would change. Stores nothing. */
export function previewRescore(): Promise<{ summary: RescoreSummary }> {
  return apiFetch('/api/rescore');
}

/** Re-scores every stored transaction with the current rules. */
export function runRescore(): Promise<{ summary: RescoreSummary }> {
  return apiFetch('/api/rescore', { method: 'POST' });
}
