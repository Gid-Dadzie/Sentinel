import { calculateFraudRisk } from '../calculateFraudRisk';
import { createDefaultRules } from '../rules';
import { makeHistory, makeTx, onlyRules, ruleIds } from '../testing';

describe('calculateFraudRisk', () => {
  // Checklist 1
  describe('unusual amount', () => {
    const rules = onlyRules('amount');
    const history = makeHistory(3, 100); // average 100

    it('does not trigger at exactly 5x the average', () => {
      const result = calculateFraudRisk(
        makeTx({ amount: 500, timestamp: '2026-09-20T12:00:00' }),
        history,
        rules,
      );
      expect(result.reasons).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('triggers just above 5x the average', () => {
      const result = calculateFraudRisk(
        makeTx({ amount: 500.01, timestamp: '2026-09-20T12:00:00' }),
        history,
        rules,
      );
      expect(ruleIds(result.reasons)).toEqual(['amount']);
      expect(result.score).toBe(25);
      expect(result.reasons[0]?.text).toContain('GHS 100');
    });

    // Checklist 2
    it.each([0, 1, 2])('never triggers with %i prior transactions', (n) => {
      const result = calculateFraudRisk(
        makeTx({ amount: 1_000_000, timestamp: '2026-09-20T12:00:00' }),
        makeHistory(n, 1),
        rules,
      );
      expect(result.reasons).toEqual([]);
    });
  });

  // Checklist 3
  describe('unusual time', () => {
    const rules = onlyRules('time');

    it.each(['00:00', '02:34', '04:59'])('triggers at %s', (time) => {
      const result = calculateFraudRisk(makeTx({ timestamp: `2026-09-20T${time}:00` }), [], rules);
      expect(ruleIds(result.reasons)).toEqual(['time']);
      expect(result.score).toBe(10);
    });

    it.each(['05:00', '12:00', '23:59'])('does not trigger at %s', (time) => {
      const result = calculateFraudRisk(makeTx({ timestamp: `2026-09-20T${time}:00` }), [], rules);
      expect(result.reasons).toEqual([]);
    });
  });

  // Checklist 4
  describe('new country and new device', () => {
    const rules = onlyRules('country', 'device');

    it('first-ever transaction triggers neither', () => {
      const tx = makeTx({ city: 'London', deviceId: 'DEVICE-NEW' });
      expect(calculateFraudRisk(tx, [], rules).reasons).toEqual([]);
    });

    it('triggers both once the account has history', () => {
      const tx = makeTx({
        city: 'Lagos',
        deviceId: 'DEVICE-NEW',
        timestamp: '2026-09-20T12:00:00',
      });
      const result = calculateFraudRisk(tx, makeHistory(2), rules);
      expect(ruleIds(result.reasons)).toEqual(['country', 'device']);
      expect(result.score).toBe(35);
    });

    it('does not trigger for a known country and device', () => {
      const tx = makeTx({ city: 'Kumasi', timestamp: '2026-09-20T12:00:00' }); // Ghana, DEVICE-1
      expect(calculateFraudRisk(tx, makeHistory(2), rules).reasons).toEqual([]);
    });
  });

  // Checklist 5
  describe('rapid transactions', () => {
    const rules = onlyRules('rapid');
    const priors = ['12:00', '12:01', '12:03'].map((t) =>
      makeTx({ timestamp: `2026-09-20T${t}:00` }),
    );

    it('four transactions in 4 minutes trigger', () => {
      const result = calculateFraudRisk(
        makeTx({ timestamp: '2026-09-20T12:04:00' }),
        priors,
        rules,
      );
      expect(ruleIds(result.reasons)).toEqual(['rapid']);
      expect(result.reasons[0]?.text).toContain('4 transactions');
    });

    it('three transactions do not', () => {
      const result = calculateFraudRisk(
        makeTx({ timestamp: '2026-09-20T12:04:00' }),
        priors.slice(1),
        rules,
      );
      expect(result.reasons).toEqual([]);
    });

    it('counts a prior exactly 5 minutes earlier but not 5 minutes 1 second', () => {
      const edge = [
        makeTx({ timestamp: '2026-09-20T11:59:59' }),
        makeTx({ timestamp: '2026-09-20T12:00:00' }),
        makeTx({ timestamp: '2026-09-20T12:02:00' }),
      ];
      const atEdge = calculateFraudRisk(makeTx({ timestamp: '2026-09-20T12:05:00' }), edge, rules);
      expect(ruleIds(atEdge.reasons)).toEqual([]); // 11:59:59 is outside; only 3 in window
      const inside = calculateFraudRisk(makeTx({ timestamp: '2026-09-20T12:04:59' }), edge, rules);
      expect(ruleIds(inside.reasons)).toEqual(['rapid']);
    });
  });

  // Checklist 6
  describe('impossible travel', () => {
    const rules = onlyRules('travel');
    const accra = makeTx({ city: 'Accra', timestamp: '2026-09-20T08:00:00' });

    it('Accra to London in 60 minutes triggers', () => {
      const london = makeTx({ city: 'London', timestamp: '2026-09-20T09:00:00' });
      const result = calculateFraudRisk(london, [accra], rules);
      expect(ruleIds(result.reasons)).toEqual(['travel']);
      expect(result.score).toBe(30);
      expect(result.reasons[0]?.text).toMatch(/Accra to London is [\d,]+ km in 1 h 0 min/);
    });

    it('Accra to London in 12 hours does not', () => {
      const london = makeTx({ city: 'London', timestamp: '2026-09-20T20:00:00' });
      expect(calculateFraudRisk(london, [accra], rules).reasons).toEqual([]);
    });

    it('same timestamp in another city does not divide by zero', () => {
      const london = makeTx({ city: 'London', timestamp: '2026-09-20T08:00:00' });
      const result = calculateFraudRisk(london, [accra], rules);
      expect(ruleIds(result.reasons)).toEqual(['travel']);
      expect(result.reasons[0]?.text).not.toMatch(/Infinity|NaN/);
    });

    it('Accra to Kumasi (under 200 km) never triggers', () => {
      const kumasi = makeTx({ city: 'Kumasi', timestamp: '2026-09-20T08:05:00' });
      expect(calculateFraudRisk(kumasi, [accra], rules).reasons).toEqual([]);
    });

    it('only compares with the immediately previous transaction', () => {
      const londonEarlier = makeTx({ city: 'London', timestamp: '2026-09-20T07:30:00' });
      const accraLater = makeTx({ city: 'Accra', timestamp: '2026-09-20T20:00:00' });
      const london = makeTx({ city: 'London', timestamp: '2026-09-21T09:00:00' });
      // Previous is Accra 13 h earlier: plausible, even though an earlier London visit exists.
      expect(calculateFraudRisk(london, [londonEarlier, accraLater], rules).reasons).toEqual([]);
    });
  });

  // Checklist 7
  it('disabling a rule removes its points and reason', () => {
    const tx = makeTx({ city: 'Lagos', deviceId: 'DEVICE-NEW', timestamp: '2026-09-20T03:00:00' });
    const history = makeHistory(3);
    const all = calculateFraudRisk(tx, history, createDefaultRules());
    expect(ruleIds(all.reasons)).toContain('time');

    const rules = createDefaultRules().map((r) => (r.id === 'time' ? { ...r, enabled: false } : r));
    const without = calculateFraudRisk(tx, history, rules);
    expect(ruleIds(without.reasons)).not.toContain('time');
    expect(without.score).toBe(all.score - 10);
  });

  it('uses configured points, not the defaults', () => {
    const rules = onlyRules('time').map((r) => ({ ...r, points: 42 }));
    const result = calculateFraudRisk(makeTx({ timestamp: '2026-09-20T01:00:00' }), [], rules);
    expect(result.score).toBe(42);
    expect(result.reasons[0]?.points).toBe(42);
  });

  // Checklist 8
  it('never exceeds 100', () => {
    const accra = makeTx({ city: 'Accra', timestamp: '2026-09-20T02:00:00' });
    const burst = ['02:01', '02:02'].map((t) =>
      makeTx({ city: 'Accra', timestamp: `2026-09-20T${t}:00` }),
    );
    const tx = makeTx({
      city: 'London',
      amount: 100_000,
      deviceId: 'DEVICE-NEW',
      timestamp: '2026-09-20T02:03:00',
    });
    const result = calculateFraudRisk(tx, [accra, ...burst], createDefaultRules());
    expect(result.reasons).toHaveLength(6); // 25+10+20+15+20+30 = 120 raw
    expect(result.score).toBe(100);
  });

  it('is deterministic and does not mutate its inputs', () => {
    const tx = makeTx({ city: 'Lagos', timestamp: '2026-09-20T03:00:00' });
    const history = makeHistory(4);
    const rules = createDefaultRules();
    const snapshot = JSON.stringify({ tx, history, rules });
    const first = calculateFraudRisk(tx, history, rules);
    expect(calculateFraudRisk(tx, history, rules)).toEqual(first);
    expect(JSON.stringify({ tx, history, rules })).toBe(snapshot);
  });

  // Checklist 10 (engine-level; the generated-data version is added with the data generator)
  it('TX-10482 profile scores 70+ with amount, time, country and device reasons', () => {
    const history = makeHistory(30, 850).map((tx) => ({
      ...tx,
      accountId: 'ACC-2001',
      deviceId: 'DEVICE-114',
    }));
    const tx = makeTx({
      id: 'TX-10482',
      accountId: 'ACC-2001',
      customerName: 'John Mensah',
      amount: 15_400,
      merchant: 'Electronics Store',
      category: 'electronics',
      city: 'Lagos',
      timestamp: '2026-10-05T02:34:00',
      deviceId: 'DEVICE-921',
    });
    const result = calculateFraudRisk(tx, history, createDefaultRules());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(ruleIds(result.reasons)).toEqual(
      expect.arrayContaining(['amount', 'time', 'country', 'device']),
    );
    expect(result.reasons.find((r) => r.ruleId === 'amount')?.text).toBe(
      "Amount GHS 15,400 is 18.1× this customer's average of GHS 850.",
    );
  });
});
