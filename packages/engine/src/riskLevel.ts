import type { RiskLevel, Status } from './types';

/** 0-25 low, 26-50 medium, 51-75 high, 76-100 critical. */
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

/** Prototype choice: above 75 declined, 51-75 pending, otherwise approved. */
export function getStatus(score: number): Status {
  if (score > 75) return 'declined';
  if (score > 50) return 'pending';
  return 'approved';
}

/** Flagged means medium risk or higher. */
export function isFlagged(score: number): boolean {
  return score > 25;
}
