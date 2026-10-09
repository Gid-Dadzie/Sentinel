import { createDefaultRules, scoreAll } from '@sentinel/engine';
import { CUSTOMERS, generateTransactions } from '../generateData';
import { CITIES } from '@sentinel/engine';

const data = generateTransactions();
const scored = scoreAll(data, createDefaultRules());
const byId = new Map(scored.map((tx) => [tx.id, tx]));
const reasonsOf = (id: string) => byId.get(id)?.fraudReasons.map((r) => r.ruleId) ?? [];

describe('generateTransactions', () => {
  it('is deterministic for the same seed', () => {
    expect(generateTransactions()).toEqual(data);
  });

  it('differs for another seed', () => {
    expect(generateTransactions(1)).not.toEqual(data);
  });

  it('produces about 380 transactions for 10 customers', () => {
    expect(data.length).toBeGreaterThanOrEqual(360);
    expect(data.length).toBeLessThanOrEqual(400);
    expect(new Set(data.map((t) => t.accountId)).size).toBe(10);
    expect(CUSTOMERS).toHaveLength(10);
  });

  it('has unique IDs and is chronological', () => {
    expect(new Set(data.map((t) => t.id)).size).toBe(data.length);
    const stamps = data.map((t) => t.timestamp);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('keeps every transaction between 1 Sep and 5 Oct 2026 in a known city', () => {
    for (const tx of data) {
      expect(tx.timestamp >= '2026-09-01T00:00:00').toBe(true);
      expect(tx.timestamp <= '2026-10-05T23:59:59').toBe(true);
      expect(Object.keys(CITIES)).toContain(tx.location.city);
      expect(tx.currency).toBe('GHS');
    }
  });

  it('includes the fixed TX-10482 example', () => {
    expect(data.find((t) => t.id === 'TX-10482')).toMatchObject({
      accountId: 'ACC-2001',
      customerName: 'John Mensah',
      amount: 15_400,
      merchant: 'Electronics Store',
      location: { city: 'Lagos', country: 'Nigeria' },
      timestamp: '2026-10-05T02:34:00',
      deviceId: 'DEVICE-921',
    });
  });

  it("puts John Mensah's average before TX-10482 at about GHS 850", () => {
    const prior = data.filter(
      (t) => t.accountId === 'ACC-2001' && t.timestamp < '2026-10-05T02:34:00',
    );
    const average = prior.reduce((sum, t) => sum + t.amount, 0) / prior.length;
    expect(average).toBeGreaterThan(750);
    expect(average).toBeLessThan(950);
  });
});

describe('scored generated data', () => {
  // Checklist 10, against the generated data
  it('scores TX-10482 at 70+ with amount, time, country and device reasons', () => {
    const tx = byId.get('TX-10482');
    expect(tx?.riskScore).toBeGreaterThanOrEqual(70);
    expect(reasonsOf('TX-10482')).toEqual(
      expect.arrayContaining(['amount', 'time', 'country', 'device']),
    );
  });

  it('flags each injected anomaly with the expected rule', () => {
    const find = (accountId: string, timestamp: string) =>
      scored.find((t) => t.accountId === accountId && t.timestamp === timestamp);

    const dubai = find('ACC-2002', '2026-09-22T03:12:00');
    expect(dubai?.fraudReasons.map((r) => r.ruleId)).toEqual(['amount', 'time', 'country']);

    const burstEnd = find('ACC-2003', '2026-09-27T01:14:00');
    expect(burstEnd?.fraudReasons.map((r) => r.ruleId)).toContain('rapid');

    const london = find('ACC-2004', '2026-09-14T01:40:00');
    expect(london?.fraudReasons.map((r) => r.ruleId)).toContain('travel');
    expect(london?.riskLevel).toBe('critical');

    const newDevice = find('ACC-2005', '2026-10-02T15:20:00');
    expect(newDevice?.fraudReasons.map((r) => r.ruleId)).toEqual(['amount', 'device']);
  });

  it('leaves most normal transactions low risk', () => {
    const low = scored.filter((t) => t.riskLevel === 'low').length;
    expect(low / scored.length).toBeGreaterThan(0.9);
  });
});
