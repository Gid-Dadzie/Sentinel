import { createDefaultRules, getRiskLevel, getStatus } from '../../engine';
import { makeTx } from '../../engine/__tests__/helpers';
import type { FraudReason, ScoredTransaction } from '../../types';
import { getAccountBaseline, getRuleOutcomes, uncappedTotal } from '../investigation';

function scored(overrides: Parameters<typeof makeTx>[0] = {}): ScoredTransaction {
  return {
    ...makeTx(overrides),
    riskScore: 0,
    riskLevel: getRiskLevel(0),
    status: getStatus(0),
    fraudReasons: [],
  };
}

describe('getAccountBaseline', () => {
  const a1 = scored({ amount: 100, timestamp: '2026-09-01T10:00:00', deviceId: 'D-1' });
  const a2 = scored({ amount: 300, timestamp: '2026-09-02T10:00:00', deviceId: 'D-2' });
  const other = scored({ accountId: 'ACC-OTHER', timestamp: '2026-09-02T11:00:00' });
  const target = scored({ timestamp: '2026-09-03T10:00:00', city: 'Lagos', deviceId: 'D-9' });
  const later = scored({ timestamp: '2026-09-04T10:00:00' });

  it('uses only earlier transactions from the same account, oldest first', () => {
    const baseline = getAccountBaseline([later, target, other, a2, a1], target);
    expect(baseline.history.map((t) => t.id)).toEqual([a1.id, a2.id]);
    expect(baseline.previous?.id).toBe(a2.id);
    expect(baseline.averageAmount).toBe(200);
  });

  it('reports known countries and devices and whether this one is new', () => {
    const baseline = getAccountBaseline([a1, a2, target], target);
    expect(baseline.knownCountries).toEqual(['Ghana']);
    expect(baseline.knownDevices).toEqual(['D-1', 'D-2']);
    expect(baseline.countryKnown).toBe(false);
    expect(baseline.deviceKnown).toBe(false);
  });

  it('has no average or previous for a first transaction', () => {
    const baseline = getAccountBaseline([a1], a1);
    expect(baseline.averageAmount).toBeNull();
    expect(baseline.previous).toBeUndefined();
  });
});

describe('getRuleOutcomes', () => {
  it('lists triggered rules first, then clear, then disabled, keeping rule order', () => {
    const rules = createDefaultRules().map((r) =>
      r.id === 'country' ? { ...r, enabled: false } : r,
    );
    const reasons: FraudReason[] = [
      { ruleId: 'time', points: 10, text: 'night' },
      { ruleId: 'amount', points: 25, text: 'big' },
    ];
    const outcomes = getRuleOutcomes(rules, reasons);
    expect(outcomes.map((o) => `${o.state}:${o.rule.id}`)).toEqual([
      'triggered:amount',
      'triggered:time',
      'clear:device',
      'clear:rapid',
      'clear:travel',
      'disabled:country',
    ]);
  });

  it('sums points before the cap', () => {
    expect(
      uncappedTotal([
        { ruleId: 'amount', points: 80, text: '' },
        { ruleId: 'travel', points: 30, text: '' },
      ]),
    ).toBe(110);
  });
});
