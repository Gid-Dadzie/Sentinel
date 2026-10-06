import { createDefaultRules, scoreAll } from '../../engine';
import { RAW_TRANSACTIONS } from '../../state/useFraudStore';
import { RULE_IDS } from '../../types';
import { compareToDefaults, formatDelta, isRuleModified, triggerCounts } from '../rules';

describe('isRuleModified', () => {
  it('is false for defaults and true when points or enabled change', () => {
    const [amount] = createDefaultRules();
    if (!amount) throw new Error('no rules');
    expect(isRuleModified(amount)).toBe(false);
    expect(isRuleModified({ ...amount, points: amount.points + 1 })).toBe(true);
    expect(isRuleModified({ ...amount, enabled: false })).toBe(true);
  });
});

describe('triggerCounts', () => {
  it('counts each rule independently of points and of other rules', () => {
    const counts = triggerCounts(RAW_TRANSACTIONS);
    expect(Object.keys(counts).sort()).toEqual([...RULE_IDS].sort());

    // Same rule alone, with odd points, must fire on exactly the same transactions.
    for (const id of RULE_IDS) {
      const only = createDefaultRules().map((r) => ({ ...r, enabled: r.id === id, points: 7 }));
      const fired = scoreAll(RAW_TRANSACTIONS, only).filter((t) => t.fraudReasons.length > 0);
      expect(fired).toHaveLength(counts[id]);
    }
    expect(counts.amount).toBeGreaterThan(0);
  });
});

describe('compareToDefaults', () => {
  it('reports flagged, pending and declined against the baseline', () => {
    const baseline = scoreAll(RAW_TRANSACTIONS, createDefaultRules());
    const noTime = createDefaultRules().map((r) => ({ ...r, enabled: r.id !== 'time' }));
    const rows = compareToDefaults(scoreAll(RAW_TRANSACTIONS, noTime), baseline);
    expect(rows.map((r) => r.label)).toEqual(['Flagged', 'Pending review', 'Declined']);
    const flagged = rows[0];
    expect(flagged && flagged.current).toBeLessThanOrEqual(flagged?.baseline ?? 0);
    expect(compareToDefaults(baseline, baseline).every((r) => r.current === r.baseline)).toBe(true);
  });
});

describe('formatDelta', () => {
  it('formats signed changes', () => {
    expect(formatDelta(5, 3)).toBe('+2');
    expect(formatDelta(1, 4)).toBe('−3');
    expect(formatDelta(2, 2)).toBe('no change');
  });
});
