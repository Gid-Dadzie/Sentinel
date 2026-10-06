import { clampPoints, createDefaultRules } from '../engine';
import type { RuleConfig } from '../types';

export const RULES_STORAGE_KEY = 'fraud-dashboard:rules';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Rebuilds a full rule list from whatever was saved. Only `points` and
 * `enabled` are taken from storage; names and conditions always come from the
 * current defaults, unknown IDs are dropped and missing rules get defaults.
 */
export function sanitizeRules(saved: unknown): RuleConfig[] {
  const entries: unknown[] = Array.isArray(saved) ? saved : [];
  return createDefaultRules().map((rule) => {
    const match = entries.find((entry) => isRecord(entry) && entry.id === rule.id);
    if (!isRecord(match)) return rule;
    return {
      ...rule,
      points: typeof match.points === 'number' ? clampPoints(match.points) : rule.points,
      enabled: typeof match.enabled === 'boolean' ? match.enabled : rule.enabled,
    };
  });
}

/** Reads `rules` from a persisted state blob of unknown shape. */
export function rulesFromPersisted(persisted: unknown): RuleConfig[] {
  return sanitizeRules(isRecord(persisted) ? persisted.rules : undefined);
}
