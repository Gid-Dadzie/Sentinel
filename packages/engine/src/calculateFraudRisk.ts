import { getCity } from './locations';
import type { FraudReason, FraudResult, RuleId, RuleConfig, Transaction } from './types';
import { formatDuration, formatMoney, formatNumber } from './format';
import { haversine } from './haversine';
import { THRESHOLDS } from './rules';
import { HOUR_MS, MINUTE_MS, parseLocalTimestamp } from './time';

const MAX_SCORE = 100;

interface RuleContext {
  transaction: Transaction;
  /** Same account, earlier timestamps only, sorted ascending. */
  history: readonly Transaction[];
  nowMs: number;
  hour: number;
  minute: number;
}

/** Returns a plain-language reason when the rule triggers, otherwise null. */
type RuleCheck = (ctx: RuleContext) => string | null;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * One check per rule ID. Typing this as Record<RuleId, ...> makes the compiler
 * reject a new rule ID that has no check.
 */
const RULE_CHECKS: Record<RuleId, RuleCheck> = {
  amount: ({ transaction, history }) => {
    if (history.length < THRESHOLDS.amountMinHistory) return null;
    const average = history.reduce((sum, tx) => sum + tx.amount, 0) / history.length;
    if (!(transaction.amount > average * THRESHOLDS.amountMultiplier)) return null;
    const ratio = (transaction.amount / average).toFixed(1);
    return `Amount ${formatMoney(transaction.amount, transaction.currency)} is ${ratio}× this customer's average of ${formatMoney(Math.round(average), transaction.currency)}.`;
  },

  time: ({ hour, minute }) => {
    if (hour < THRESHOLDS.nightStartHour || hour >= THRESHOLDS.nightEndHour) return null;
    return `Made at ${pad(hour)}:${pad(minute)}, inside the overnight window (00:00 to 04:59).`;
  },

  country: ({ transaction, history }) => {
    if (history.length === 0) return null;
    const { country } = transaction.location;
    if (history.some((tx) => tx.location.country === country)) return null;
    const known = [...new Set(history.map((tx) => tx.location.country))].join(', ');
    return `First transaction from ${country}. Earlier transactions came from ${known}.`;
  },

  device: ({ transaction, history }) => {
    if (history.length === 0) return null;
    const knownDevices = new Set(history.map((tx) => tx.deviceId));
    if (knownDevices.has(transaction.deviceId)) return null;
    const count = knownDevices.size;
    return `Device ${transaction.deviceId} has never been used on this account (${count} known device${count === 1 ? '' : 's'}).`;
  },

  rapid: ({ history, nowMs }) => {
    const windowMs = THRESHOLDS.rapidWindowMinutes * MINUTE_MS;
    const recent = history.filter((tx) => {
      const diff = nowMs - parseLocalTimestamp(tx.timestamp).ms;
      return diff >= 0 && diff <= windowMs;
    }).length;
    const count = recent + 1; // include the current transaction
    if (count < THRESHOLDS.rapidMinCount) return null;
    return `${count} transactions within ${THRESHOLDS.rapidWindowMinutes} minutes, including this one.`;
  },

  travel: ({ transaction, history, nowMs }) => {
    const previous = history[history.length - 1];
    if (!previous || previous.location.city === transaction.location.city) return null;
    const from = getCity(previous.location.city);
    const to = getCity(transaction.location.city);
    if (!from || !to) return null; // unknown city: cannot measure distance
    const distanceKm = haversine(from, to);
    if (distanceKm <= THRESHOLDS.travelMinDistanceKm) return null;
    const elapsedMs = nowMs - parseLocalTimestamp(previous.timestamp).ms;
    const hours = Math.max(elapsedMs / HOUR_MS, THRESHOLDS.travelMinElapsedHours);
    const speedKmh = distanceKm / hours;
    if (speedKmh <= THRESHOLDS.travelMaxSpeedKmh) return null;
    return `${previous.location.city} to ${transaction.location.city} is ${formatNumber(distanceKm)} km in ${formatDuration(elapsedMs / MINUTE_MS)}, about ${formatNumber(speedKmh)} km/h. That is faster than a plane.`;
  },
};

/**
 * Pure fraud scorer. "Now" is always the transaction's own timestamp.
 * Disabled rules add no points and no reasons. The score is capped at 100.
 */
export function calculateFraudRisk(
  transaction: Transaction,
  history: readonly Transaction[],
  rules: readonly RuleConfig[],
): FraudResult {
  const { ms: nowMs, hour, minute } = parseLocalTimestamp(transaction.timestamp);
  const ctx: RuleContext = { transaction, history, nowMs, hour, minute };

  const reasons: FraudReason[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const text = RULE_CHECKS[rule.id](ctx);
    if (text !== null) reasons.push({ ruleId: rule.id, points: rule.points, text });
  }

  const total = reasons.reduce((sum, reason) => sum + reason.points, 0);
  return { score: Math.max(0, Math.min(total, MAX_SCORE)), reasons };
}
