import { createDefaultRules } from '../rules';
import { scoreAll } from '../scoreAll';
import { makeTx, ruleIds } from './helpers';

describe('scoreAll', () => {
  const rules = createDefaultRules();

  it('returns transactions in chronological order regardless of input order', () => {
    const a = makeTx({ timestamp: '2026-09-03T12:00:00' });
    const b = makeTx({ timestamp: '2026-09-01T12:00:00' });
    const c = makeTx({ timestamp: '2026-09-02T12:00:00' });
    expect(scoreAll([a, b, c], rules).map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });

  it("gives each transaction only its own account's earlier history", () => {
    const otherAccount = [1, 2, 3].map((d) =>
      makeTx({ accountId: 'ACC-OTHER', timestamp: `2026-09-0${d}T12:00:00` }),
    );
    // First-ever transaction for ACC-NEW: other accounts' history must not count.
    const first = makeTx({
      accountId: 'ACC-NEW',
      city: 'London',
      deviceId: 'DEVICE-X',
      timestamp: '2026-09-04T12:00:00',
    });
    const scored = scoreAll([...otherAccount, first], rules);
    expect(scored.find((t) => t.id === first.id)?.fraudReasons).toEqual([]);
  });

  it('does not let later transactions influence earlier ones', () => {
    const early = makeTx({ timestamp: '2026-09-01T12:00:00' });
    const later = makeTx({ timestamp: '2026-09-02T12:00:00', city: 'London', deviceId: 'D-2' });
    const scored = scoreAll([later, early], rules);
    expect(scored[0]?.fraudReasons).toEqual([]);
    expect(ruleIds(scored[1]?.fraudReasons ?? [])).toEqual(['country', 'device']);
  });

  it('sets score, level and status from the engine and does not mutate input', () => {
    const history = [1, 2, 3].map((d) => makeTx({ timestamp: `2026-09-0${d}T12:00:00` }));
    const big = makeTx({
      amount: 100_000,
      city: 'Lagos',
      deviceId: 'DEVICE-NEW',
      timestamp: '2026-09-04T03:00:00',
    });
    const input = [...history, big];
    const snapshot = JSON.stringify(input);
    const scored = scoreAll(input, rules);
    expect(scored[3]).toMatchObject({ riskScore: 70, riskLevel: 'high', status: 'pending' });
    expect(scored[0]).toMatchObject({ riskScore: 0, riskLevel: 'low', status: 'approved' });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
