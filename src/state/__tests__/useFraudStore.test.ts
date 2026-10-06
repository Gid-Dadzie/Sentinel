import { createDefaultRules } from '../../engine';
import { RULES_STORAGE_KEY, sanitizeRules } from '../rulesStorage';
import { RAW_TRANSACTIONS, useFraudStore } from '../useFraudStore';

const reasonIds = () =>
  useFraudStore.getState().transactions.flatMap((t) => t.fraudReasons.map((r) => r.ruleId));
const tx10482 = () => useFraudStore.getState().transactions.find((t) => t.id === 'TX-10482');

describe('useFraudStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useFraudStore.getState().resetRules();
  });

  it('scores every generated transaction on load', () => {
    const { transactions } = useFraudStore.getState();
    expect(transactions).toHaveLength(RAW_TRANSACTIONS.length);
    expect(tx10482()?.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('disabling a rule removes its reasons everywhere and re-scores', () => {
    const before = tx10482()?.riskScore ?? 0;
    expect(reasonIds()).toContain('time');

    useFraudStore.getState().updateRule('time', { enabled: false });

    expect(reasonIds()).not.toContain('time');
    expect(tx10482()?.riskScore).toBe(before - 10);
  });

  it('editing points re-scores and clamps to 0-100', () => {
    useFraudStore.getState().updateRule('amount', { points: 60 });
    expect(tx10482()?.fraudReasons.find((r) => r.ruleId === 'amount')?.points).toBe(60);
    expect(tx10482()?.riskScore).toBe(100);

    useFraudStore.getState().updateRule('amount', { points: 250.4 });
    expect(useFraudStore.getState().rules.find((r) => r.id === 'amount')?.points).toBe(100);
  });

  it('reset restores the defaults', () => {
    useFraudStore.getState().updateRule('device', { enabled: false, points: 1 });
    useFraudStore.getState().resetRules();
    expect(useFraudStore.getState().rules).toEqual(createDefaultRules());
  });

  it('persists only the rules to localStorage', () => {
    useFraudStore.getState().updateRule('rapid', { points: 33 });
    const saved = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(Object.keys(saved.state)).toEqual(['rules']);
    expect(JSON.stringify(saved.state.rules)).toContain('"points":33');
  });

  it('rehydrates saved rules and re-scores', async () => {
    const rules = createDefaultRules().map((r) =>
      r.id === 'country' ? { ...r, enabled: false } : r,
    );
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify({ state: { rules }, version: 1 }));
    await useFraudStore.persist.rehydrate();
    expect(useFraudStore.getState().rules.find((r) => r.id === 'country')?.enabled).toBe(false);
    expect(reasonIds()).not.toContain('country');
  });

  it('falls back to defaults when stored data is corrupt', async () => {
    localStorage.setItem(
      RULES_STORAGE_KEY,
      JSON.stringify({ state: { rules: 'oops' }, version: 1 }),
    );
    await useFraudStore.persist.rehydrate();
    expect(useFraudStore.getState().rules).toEqual(createDefaultRules());
  });
});

describe('sanitizeRules', () => {
  it('keeps valid overrides, clamps points, ignores unknown fields and IDs', () => {
    const rules = sanitizeRules([
      { id: 'amount', points: 999, enabled: false, name: 'Hacked' },
      { id: 'time', points: 'ten', enabled: 'yes' },
      { id: 'bogus', points: 5, enabled: true },
      null,
    ]);
    const defaults = createDefaultRules();
    expect(rules).toHaveLength(defaults.length);
    expect(rules[0]).toEqual({ ...defaults[0], points: 100, enabled: false });
    expect(rules[1]).toEqual(defaults[1]);
  });
});
