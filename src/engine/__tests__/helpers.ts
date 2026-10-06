import { CITIES, type CityName } from '../../data/locations';
import type { RuleConfig, RuleId, Transaction } from '../../types';
import { createDefaultRules } from '../rules';

let counter = 0;

/** Builds a valid transaction with sensible defaults; override what the test cares about. */
export function makeTx(
  overrides: Partial<Omit<Transaction, 'location'>> & { city?: CityName } = {},
): Transaction {
  const { city = 'Accra', ...rest } = overrides;
  counter += 1;
  return {
    id: `TX-T${counter}`,
    accountId: 'ACC-TEST',
    customerName: 'Test Customer',
    amount: 100,
    currency: 'GHS',
    merchant: 'Corner Shop',
    category: 'groceries',
    location: { city, country: CITIES[city].country },
    timestamp: '2026-09-10T12:00:00',
    deviceId: 'DEVICE-1',
    status: 'approved',
    ...rest,
  };
}

/** n prior transactions, one per day at noon, all in Accra on DEVICE-1. */
export function makeHistory(n: number, amount = 100): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    makeTx({ amount, timestamp: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00` }),
  );
}

/** Default rules with only the listed rules enabled, to test one rule at a time. */
export function onlyRules(...ids: RuleId[]): RuleConfig[] {
  return createDefaultRules().map((rule) => ({ ...rule, enabled: ids.includes(rule.id) }));
}

export const ruleIds = (reasons: { ruleId: RuleId }[]) => reasons.map((r) => r.ruleId);
