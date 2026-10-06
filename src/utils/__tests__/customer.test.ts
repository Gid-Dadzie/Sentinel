import { getRiskLevel, getStatus } from '../../engine';
import { makeTx } from '../../engine/__tests__/helpers';
import type { ScoredTransaction } from '../../types';
import { getCustomerProfile } from '../customer';

function scored(
  riskScore: number,
  overrides: Parameters<typeof makeTx>[0] = {},
): ScoredTransaction {
  return {
    ...makeTx(overrides),
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    status: getStatus(riskScore),
    fraudReasons: [],
  };
}

describe('getCustomerProfile', () => {
  const t1 = scored(0, { amount: 100, timestamp: '2026-09-01T10:00:00', deviceId: 'D-1' });
  const t2 = scored(40, {
    amount: 500,
    timestamp: '2026-09-03T10:00:00',
    city: 'Lagos',
    deviceId: 'D-2',
    category: 'electronics',
  });
  const t3 = scored(10, { amount: 300, timestamp: '2026-09-02T10:00:00', deviceId: 'D-1' });
  const other = scored(90, { accountId: 'ACC-OTHER' });

  it('returns null for an account with no transactions', () => {
    expect(getCustomerProfile([t1, other], 'ACC-NONE')).toBeNull();
  });

  it('summarises only this account, oldest first', () => {
    const profile = getCustomerProfile([t2, other, t1, t3], 'ACC-TEST');
    expect(profile?.transactions.map((t) => t.id)).toEqual([t1.id, t3.id, t2.id]);
    expect(profile).toMatchObject({
      name: 'Test Customer',
      totalAmount: 900,
      averageAmount: 300,
      maxScore: 40,
      firstSeen: '2026-09-01T10:00:00',
      lastSeen: '2026-09-03T10:00:00',
    });
    expect(profile?.flagged.map((t) => t.id)).toEqual([t2.id]);
  });

  it('counts countries, cities, devices and categories, most used first', () => {
    const profile = getCustomerProfile([t1, t2, t3], 'ACC-TEST');
    expect(profile?.countries.map((c) => [c.name, c.count])).toEqual([
      ['Ghana', 2],
      ['Nigeria', 1],
    ]);
    expect(profile?.cities.map((c) => c.name)).toEqual(['Accra', 'Lagos']);
    expect(profile?.devices[0]).toEqual({
      name: 'D-1',
      count: 2,
      firstSeen: '2026-09-01T10:00:00',
      lastSeen: '2026-09-02T10:00:00',
    });
    expect(profile?.categories.map((c) => c.name)).toEqual(['groceries', 'electronics']);
  });
});
