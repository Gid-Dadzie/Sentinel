import { createDefaultRules, scoreAll, type Transaction } from '@sentinel/engine';
import { makeHistory, makeTx } from '@sentinel/engine/testing';
import { scoreImport, toEngineRules, type StoredHistory } from '../score';
import type { ImportRow } from '../validate';

const rules = createDefaultRules();

function asRow(tx: Transaction): ImportRow {
  return {
    id: tx.id,
    accountId: tx.accountId,
    customerName: tx.customerName,
    amount: tx.amount,
    currency: tx.currency,
    txnType: 'payment',
    timestamp: tx.timestamp,
    merchant: tx.merchant,
    category: tx.category,
    city: tx.location.city,
    country: tx.location.country,
    deviceId: tx.deviceId,
    senderMsisdn: '024****601',
    recipientMsisdn: null,
    agentId: null,
  };
}

const asStored = (tx: Transaction): StoredHistory => tx;

/** Two accounts with normal history, then a burst of suspicious activity. */
function dataset(): Transaction[] {
  const a = makeHistory(6, 200);
  const b = makeHistory(4, 50).map((tx) => ({ ...tx, accountId: 'ACC-B' }));
  return [
    ...a,
    ...b,
    makeTx({ amount: 5000, timestamp: '2026-09-20T02:34:00', city: 'Lagos', deviceId: 'D-9' }),
    makeTx({ timestamp: '2026-09-20T03:30:00', city: 'London' }),
    ...[0, 1, 2, 3].map((m) =>
      makeTx({ accountId: 'ACC-B', timestamp: `2026-09-21T10:0${m}:00`, deviceId: 'D-2' }),
    ),
  ];
}

describe('scoreImport', () => {
  it("gives exactly the engine's scores however history is split between stored rows and the file", () => {
    const all = dataset();
    const expected = new Map(scoreAll(all, rules).map((s) => [s.id, s]));

    for (const cut of [0, 3, 8, all.length - 2]) {
      const stored = all.slice(0, cut);
      const fresh = all.slice(cut);
      const scored = scoreImport(fresh.map(asRow), stored.map(asStored), rules);
      expect(scored).toHaveLength(fresh.length);
      for (const s of scored) {
        const want = expected.get(s.id);
        expect({ id: s.id, score: s.riskScore, reasons: s.reasons }).toEqual({
          id: s.id,
          score: want?.riskScore,
          reasons: want?.fraudReasons,
        });
      }
    }
  });

  it('flags a large night-time purchase in a new country on a new device', () => {
    const history = makeHistory(5, 850);
    const big = makeTx({
      amount: 15400,
      timestamp: '2026-10-05T02:34:00',
      city: 'Lagos',
      deviceId: 'DEVICE-921',
    });
    const [scored] = scoreImport([asRow(big)], history, rules);
    expect(scored?.riskScore).toBe(70);
    expect(scored?.riskLevel).toBe('high');
    expect(scored?.status).toBe('pending');
    expect(scored?.reasons.map((r) => r.ruleId)).toEqual(['amount', 'time', 'country', 'device']);
  });

  it('only sees earlier transactions of the same account', () => {
    const later = makeTx({ timestamp: '2026-12-01T12:00:00', deviceId: 'D-OTHER' });
    const otherAccount = makeTx({ accountId: 'ACC-OTHER', timestamp: '2026-08-01T12:00:00' });
    const first = makeTx({ timestamp: '2026-09-01T12:00:00' });
    const [scored] = scoreImport([asRow(first)], [later, otherAccount], rules);
    expect(scored?.riskScore).toBe(0); // first in its account: no history, nothing to compare
  });

  it('uses only rules the engine knows, as stored (points and switches)', () => {
    const stored = [
      { id: 'amount', name: 'Unusual amount', condition: '', points: 40, enabled: true },
      { id: 'time', name: 'Unusual time', condition: '', points: 10, enabled: false },
      { id: 'rapid_cash_out', name: 'Future rule', condition: '', points: 5, enabled: true },
    ];
    expect(toEngineRules(stored).map((r) => [r.id, r.points, r.enabled])).toEqual([
      ['amount', 40, true],
      ['time', 10, false],
    ]);
  });
});
