import { makeTx } from '@sentinel/engine/testing';
import { getRiskLevel, getStatus } from '@sentinel/engine';
import type { ScoredTransaction } from '../../types';
import {
  DEFAULT_FILTERS,
  applyFilters,
  calendarWeeks,
  countByRiskLevel,
  countNeedsReview,
  getReviewQueue,
  dailyCounts,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  listCountries,
  paginate,
  summarize,
  type TableFilters,
} from '../dashboard';
import { formatDate, formatDateTime, formatShortDate } from '../format';

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

const filters = (patch: Partial<TableFilters>): TableFilters => ({ ...DEFAULT_FILTERS, ...patch });

describe('summarize', () => {
  it('counts flagged, declined and pending and sums all and flagged amounts', () => {
    const txs = [scored(10, { amount: 100 }), scored(30, { amount: 200 }), scored(60), scored(90)];
    expect(summarize(txs)).toEqual({
      total: 4,
      flagged: 3,
      declined: 1,
      pending: 1,
      totalAmount: 500,
      flaggedAmount: 400,
    });
  });

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({
      total: 0,
      flagged: 0,
      declined: 0,
      pending: 0,
      totalAmount: 0,
      flaggedAmount: 0,
    });
  });
});

describe('countByRiskLevel', () => {
  it('returns every level in severity order, including zeros', () => {
    expect(countByRiskLevel([scored(5), scored(20), scored(80)])).toEqual([
      { level: 'low', count: 2 },
      { level: 'medium', count: 0 },
      { level: 'high', count: 0 },
      { level: 'critical', count: 1 },
    ]);
  });
});

describe('dailyCounts', () => {
  it('groups by calendar date in date order', () => {
    const txs = [
      scored(40, { timestamp: '2026-09-02T09:00:00' }),
      scored(5, { timestamp: '2026-09-01T23:59:00' }),
      scored(5, { timestamp: '2026-09-02T00:10:00' }),
    ];
    expect(dailyCounts(txs)).toEqual([
      { date: '2026-09-01', total: 1, flagged: 0 },
      { date: '2026-09-02', total: 2, flagged: 1 },
    ]);
  });
});

describe('URL filters', () => {
  it('parses valid params', () => {
    const params = new URLSearchParams(
      'q=%20kofi%20&risk=high&status=pending&country=Nigeria&min=1500&from=2026-09-15&flagged=1&sort=score&dir=asc&page=3',
    );
    expect(filtersFromParams(params)).toEqual({
      query: 'kofi',
      risk: 'high',
      status: 'pending',
      country: 'Nigeria',
      minAmount: 1500,
      from: '2026-09-15',
      flaggedOnly: true,
      sort: 'score',
      dir: 'asc',
      page: 3,
    });
  });

  it('falls back to defaults for invalid values', () => {
    const params = new URLSearchParams(
      'risk=extreme&status=x&min=-5&from=15/09/2026&sort=name&dir=up&page=-2',
    );
    expect(filtersFromParams(params)).toEqual(DEFAULT_FILTERS);
    expect(filtersFromParams(new URLSearchParams('page=1.5')).page).toBe(1);
  });

  it('writes nothing for the defaults and round-trips the rest', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('');
    const custom = filters({
      query: 'acc',
      risk: 'critical',
      country: 'Ghana',
      minAmount: 250.5,
      from: '2026-09-02',
      flaggedOnly: true,
      page: 2,
    });
    expect(filtersFromParams(filtersToParams(custom))).toEqual(custom);
  });
});

describe('applyFilters', () => {
  const a = scored(80, {
    id: 'TX-A',
    amount: 500,
    customerName: 'Kofi Annor',
    timestamp: '2026-09-01T10:00:00',
  });
  const b = scored(10, {
    id: 'TX-B',
    amount: 900,
    merchant: 'Melcom',
    timestamp: '2026-09-02T10:00:00',
  });
  const c = scored(40, {
    id: 'TX-C',
    amount: 500,
    city: 'Lagos',
    timestamp: '2026-09-03T10:00:00',
  });
  const all = [a, b, c];
  const ids = (txs: ScoredTransaction[]) => txs.map((t) => t.id);

  it('defaults to newest first', () => {
    expect(ids(applyFilters(all, DEFAULT_FILTERS))).toEqual(['TX-C', 'TX-B', 'TX-A']);
  });

  it('searches ID, customer, merchant and city case-insensitively', () => {
    expect(ids(applyFilters(all, filters({ query: 'kofi' })))).toEqual(['TX-A']);
    expect(ids(applyFilters(all, filters({ query: 'MELCOM' })))).toEqual(['TX-B']);
    expect(ids(applyFilters(all, filters({ query: 'lagos' })))).toEqual(['TX-C']);
    expect(ids(applyFilters(all, filters({ query: 'tx-b' })))).toEqual(['TX-B']);
  });

  it('filters by risk level, status and flagged', () => {
    expect(ids(applyFilters(all, filters({ risk: 'critical' })))).toEqual(['TX-A']);
    expect(ids(applyFilters(all, filters({ status: 'approved' })))).toEqual(['TX-C', 'TX-B']);
    expect(ids(applyFilters(all, filters({ flaggedOnly: true })))).toEqual(['TX-C', 'TX-A']);
  });

  it('filters by country, minimum amount and from date', () => {
    expect(ids(applyFilters(all, filters({ country: 'Nigeria' })))).toEqual(['TX-C']);
    expect(ids(applyFilters(all, filters({ minAmount: 600 })))).toEqual(['TX-B']);
    expect(ids(applyFilters(all, filters({ minAmount: 500 })))).toEqual(['TX-C', 'TX-B', 'TX-A']);
    expect(ids(applyFilters(all, filters({ from: '2026-09-02' })))).toEqual(['TX-C', 'TX-B']);
  });

  it('lists countries alphabetically and knows when filters are active', () => {
    expect(listCountries(all)).toEqual(['Ghana', 'Nigeria']);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ sort: 'amount', page: 3 }))).toBe(false);
    expect(hasActiveFilters(filters({ minAmount: 10 }))).toBe(true);
  });

  it('sorts by amount and score, breaking ties chronologically', () => {
    expect(ids(applyFilters(all, filters({ sort: 'amount', dir: 'asc' })))).toEqual([
      'TX-A',
      'TX-C',
      'TX-B',
    ]);
    expect(ids(applyFilters(all, filters({ sort: 'amount', dir: 'desc' })))).toEqual([
      'TX-B',
      'TX-C',
      'TX-A',
    ]);
    expect(ids(applyFilters(all, filters({ sort: 'score' })))).toEqual(['TX-A', 'TX-C', 'TX-B']);
  });

  it('does not mutate the input', () => {
    const input = [...all];
    applyFilters(input, filters({ sort: 'amount' }));
    expect(input).toEqual(all);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i);

  it('shows 12 per page by default and reports the page count', () => {
    expect(paginate(items, 4)).toEqual({
      items: [36, 37, 38, 39, 40, 41, 42, 43, 44],
      page: 4,
      pageCount: 4,
    });
    expect(paginate(items, 2, 20).items).toHaveLength(20);
  });

  it('clamps out-of-range pages', () => {
    expect(paginate(items, 99).page).toBe(4);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate([], 4)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});

describe('date formatting', () => {
  it('formats local timestamps without a time zone shift', () => {
    expect(formatDateTime('2026-10-05T02:34:00')).toBe('5 Oct 2026, 02:34');
    expect(formatDate('2026-09-01')).toBe('1 Sep 2026');
    expect(formatShortDate('2026-09-01')).toBe('1 Sep');
  });
});

describe('review queue', () => {
  const a = scored(30, { id: 'Q-A', timestamp: '2026-09-01T10:00:00' });
  const b = scored(80, { id: 'Q-B', timestamp: '2026-09-02T10:00:00' });
  const c = scored(30, { id: 'Q-C', timestamp: '2026-09-03T10:00:00' });
  const low = scored(5, { id: 'Q-LOW' });
  const reviewed = scored(90, { id: 'Q-DONE' });
  const reviews = { 'Q-DONE': { verdict: 'fraud' as const, note: '', reviewedAt: 'x' } };

  it('holds flagged, unreviewed transactions, riskiest then newest first', () => {
    const queue = getReviewQueue([a, b, c, low, reviewed], reviews);
    expect(queue.map((t) => t.id)).toEqual(['Q-B', 'Q-C', 'Q-A']);
    expect(countNeedsReview([a, b, c, low, reviewed], reviews)).toBe(3);
  });
});

describe('calendarWeeks', () => {
  it('pads to Monday-first weeks and fills missing days with zeros', () => {
    // 1 Sep 2026 is a Tuesday; 7 Sep is the next Monday.
    const weeks = calendarWeeks([
      { date: '2026-09-01', total: 3, flagged: 1 },
      { date: '2026-09-07', total: 2, flagged: 0 },
    ]);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]).toBeNull(); // Monday 31 Aug is before the range
    expect(weeks[0]?.[1]).toEqual({ date: '2026-09-01', total: 3, flagged: 1 });
    expect(weeks[0]?.[2]).toEqual({ date: '2026-09-02', total: 0, flagged: 0 });
    expect(weeks[1]?.[0]?.date).toBe('2026-09-07');
    expect(weeks[1]?.[1]).toBeNull(); // after the range
    expect(calendarWeeks([])).toEqual([]);
  });
});
