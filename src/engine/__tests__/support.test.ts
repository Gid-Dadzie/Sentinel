import { CITIES } from '../../data/locations';
import { RULE_IDS } from '../../types';
import { haversine } from '../haversine';
import { DEFAULT_RULES, createDefaultRules } from '../rules';
import { parseLocalTimestamp } from '../time';

describe('haversine', () => {
  it('is zero for the same point', () => {
    expect(haversine(CITIES.Accra, CITIES.Accra)).toBe(0);
  });

  it('measures Accra to London at about 5,100 km', () => {
    const km = haversine(CITIES.Accra, CITIES.London);
    expect(km).toBeGreaterThan(5000);
    expect(km).toBeLessThan(5200);
  });

  it('is symmetric', () => {
    expect(haversine(CITIES.Lagos, CITIES.Dubai)).toBeCloseTo(
      haversine(CITIES.Dubai, CITIES.Lagos),
      9,
    );
  });
});

describe('parseLocalTimestamp', () => {
  it('reads the hour without applying a time zone', () => {
    expect(parseLocalTimestamp('2026-10-05T02:34:00')).toMatchObject({ hour: 2, minute: 34 });
  });

  it('measures differences across days', () => {
    const a = parseLocalTimestamp('2026-09-30T23:58:00').ms;
    const b = parseLocalTimestamp('2026-10-01T00:02:00').ms;
    expect(b - a).toBe(4 * 60_000);
  });

  it('rejects malformed input', () => {
    expect(() => parseLocalTimestamp('yesterday')).toThrow(/Invalid local timestamp/);
  });
});

describe('default rules', () => {
  it('define every rule ID exactly once, all enabled', () => {
    expect(DEFAULT_RULES.map((r) => r.id).sort()).toEqual([...RULE_IDS].sort());
    expect(DEFAULT_RULES.every((r) => r.enabled)).toBe(true);
  });

  it('match the documented default points', () => {
    const points = Object.fromEntries(DEFAULT_RULES.map((r) => [r.id, r.points]));
    expect(points).toEqual({
      amount: 25,
      time: 10,
      country: 20,
      device: 15,
      rapid: 20,
      travel: 30,
    });
  });

  it('createDefaultRules returns independent copies', () => {
    const [first] = createDefaultRules();
    if (first) first.points = 99;
    expect(DEFAULT_RULES.find((r) => r.id === 'amount')?.points).toBe(25);
  });
});
