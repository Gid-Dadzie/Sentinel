import { formatNumber } from './format';
import type { RuleConfig } from './types';

/** Thresholds shared by the rule checks and their descriptions. */
export const THRESHOLDS = {
  amountMinHistory: 3,
  amountMultiplier: 5,
  nightStartHour: 0,
  nightEndHour: 5, // exclusive: 04:59 triggers, 05:00 does not
  rapidWindowMinutes: 5,
  rapidMinCount: 4,
  travelMinDistanceKm: 200,
  travelMaxSpeedKmh: 900,
  travelMinElapsedHours: 0.01,
  // Mobile money
  cashOutWindowMinutes: 30,
  cashOutShareOfDeposits: 0.8,
  recipientsWindowMinutes: 60,
  recipientsMinCount: 5,
  agentMinHistory: 3,
  agentAmountMultiplier: 3,
  airtimeWindowMinutes: 10,
  airtimeMinCount: 5,
  /** A reporting limit transactions may be kept just under, in the transaction's currency. */
  structuringLimit: 10_000,
  /** "Just under" means at least this share of the limit. */
  structuringNearShare: 0.9,
  structuringWindowHours: 24,
  structuringMinCount: 3,
} as const;

export const DEFAULT_RULES: readonly RuleConfig[] = [
  {
    id: 'amount',
    name: 'Unusual amount',
    condition: `At least ${THRESHOLDS.amountMinHistory} prior transactions and amount above ${THRESHOLDS.amountMultiplier}× the customer's average`,
    points: 25,
    enabled: true,
  },
  {
    id: 'time',
    name: 'Unusual time',
    condition: 'Made between 00:00 and 04:59',
    points: 10,
    enabled: true,
  },
  {
    id: 'country',
    name: 'New country',
    condition: 'Customer has history but has never transacted in this country',
    points: 20,
    enabled: true,
  },
  {
    id: 'device',
    name: 'New device',
    condition: 'Customer has history but has never used this device',
    points: 15,
    enabled: true,
  },
  {
    id: 'rapid',
    name: 'Rapid transactions',
    condition: `${THRESHOLDS.rapidMinCount} or more transactions (including this one) within ${THRESHOLDS.rapidWindowMinutes} minutes`,
    points: 20,
    enabled: true,
  },
  {
    id: 'travel',
    name: 'Impossible travel',
    condition: `City differs from the previous transaction, more than ${THRESHOLDS.travelMinDistanceKm} km away, at an implied speed above ${THRESHOLDS.travelMaxSpeedKmh} km/h`,
    points: 30,
    enabled: true,
  },
  {
    id: 'cashout',
    name: 'Rapid cash-out',
    condition: `A cash-out of at least ${THRESHOLDS.cashOutShareOfDeposits * 100}% of the money cashed in during the previous ${THRESHOLDS.cashOutWindowMinutes} minutes`,
    points: 25,
    enabled: true,
  },
  {
    id: 'recipients',
    name: 'Many recipients',
    condition: `Transfers to ${THRESHOLDS.recipientsMinCount} or more different recipients (including this one) within ${THRESHOLDS.recipientsWindowMinutes} minutes`,
    points: 20,
    enabled: true,
  },
  {
    id: 'agent',
    name: 'New agent, large cash-out',
    condition: `At least ${THRESHOLDS.agentMinHistory} prior transactions, a cash-out at an agent this account has never used, and above ${THRESHOLDS.agentAmountMultiplier}× the customer's average`,
    points: 15,
    enabled: true,
  },
  {
    id: 'airtime',
    name: 'Airtime burst',
    condition: `${THRESHOLDS.airtimeMinCount} or more airtime purchases (including this one) within ${THRESHOLDS.airtimeWindowMinutes} minutes`,
    points: 10,
    enabled: true,
  },
  {
    id: 'structuring',
    name: 'Structuring',
    condition: `${THRESHOLDS.structuringMinCount} or more transactions (including this one) within ${THRESHOLDS.structuringWindowHours} hours, each between ${THRESHOLDS.structuringNearShare * 100}% and 100% of the ${formatNumber(THRESHOLDS.structuringLimit)} reporting limit`,
    points: 20,
    enabled: true,
  },
];

export const MIN_POINTS = 0;
export const MAX_POINTS = 100;

/** Whole points between 0 and 100; anything non-numeric becomes 0. */
export function clampPoints(value: number): number {
  if (!Number.isFinite(value)) return MIN_POINTS;
  return Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(value)));
}

/** Fresh mutable copy of the defaults (for state and the reset button). */
export function createDefaultRules(): RuleConfig[] {
  return DEFAULT_RULES.map((rule) => ({ ...rule }));
}
