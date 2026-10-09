import { clampPoints, createDefaultRules } from '@sentinel/engine';
import { VERDICTS, type Review, type RuleConfig } from '../types';

/** Holds rules and analyst reviews; the key name predates reviews and is kept so saved rules survive. */
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

const MAX_NOTE_LENGTH = 2000;

/** Keeps only well-formed reviews keyed by transaction ID; anything else is dropped. */
export function sanitizeReviews(saved: unknown): Record<string, Review> {
  const reviews: Record<string, Review> = {};
  if (!isRecord(saved)) return reviews;
  for (const [id, value] of Object.entries(saved)) {
    if (!isRecord(value)) continue;
    const verdict = VERDICTS.find((v) => v === value.verdict);
    if (!verdict || typeof value.reviewedAt !== 'string') continue;
    const note = typeof value.note === 'string' ? value.note.slice(0, MAX_NOTE_LENGTH) : '';
    reviews[id] = { verdict, note, reviewedAt: value.reviewedAt };
  }
  return reviews;
}

/** Reads `reviews` from a persisted state blob of unknown shape. */
export function reviewsFromPersisted(persisted: unknown): Record<string, Review> {
  return sanitizeReviews(isRecord(persisted) ? persisted.reviews : undefined);
}
