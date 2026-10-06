import { compareChronological, isFlagged } from '../engine';
import {
  RISK_LEVELS,
  STATUSES,
  type RiskLevel,
  type ScoredTransaction,
  type Status,
} from '../types';

export interface DashboardSummary {
  total: number;
  flagged: number;
  declined: number;
  pending: number;
  /** Sum of flagged amounts (all generated data is in one currency). */
  flaggedAmount: number;
}

export function summarize(transactions: readonly ScoredTransaction[]): DashboardSummary {
  const summary: DashboardSummary = {
    total: transactions.length,
    flagged: 0,
    declined: 0,
    pending: 0,
    flaggedAmount: 0,
  };
  for (const tx of transactions) {
    if (isFlagged(tx.riskScore)) {
      summary.flagged += 1;
      summary.flaggedAmount += tx.amount;
    }
    if (tx.status === 'declined') summary.declined += 1;
    if (tx.status === 'pending') summary.pending += 1;
  }
  return summary;
}

export interface RiskLevelCount {
  level: RiskLevel;
  count: number;
}

/** One entry per risk level, in severity order, including empty levels. */
export function countByRiskLevel(transactions: readonly ScoredTransaction[]): RiskLevelCount[] {
  const counts = new Map<RiskLevel, number>(RISK_LEVELS.map((level) => [level, 0]));
  for (const tx of transactions) counts.set(tx.riskLevel, (counts.get(tx.riskLevel) ?? 0) + 1);
  return RISK_LEVELS.map((level) => ({ level, count: counts.get(level) ?? 0 }));
}

export interface DailyCount {
  date: string; // "2026-10-05"
  total: number;
  flagged: number;
}

/** Per-day totals in date order. Only days that have transactions appear. */
export function dailyCounts(transactions: readonly ScoredTransaction[]): DailyCount[] {
  const byDate = new Map<string, DailyCount>();
  for (const tx of transactions) {
    const date = tx.timestamp.slice(0, 10);
    let day = byDate.get(date);
    if (!day) {
      day = { date, total: 0, flagged: 0 };
      byDate.set(date, day);
    }
    day.total += 1;
    if (isFlagged(tx.riskScore)) day.flagged += 1;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Table filters (kept in the URL so views can be shared and survive reloads) ----

export const SORT_KEYS = ['time', 'amount', 'score'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export interface TableFilters {
  query: string;
  risk: RiskLevel | 'all';
  status: Status | 'all';
  flaggedOnly: boolean;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_FILTERS: Readonly<TableFilters> = {
  query: '',
  risk: 'all',
  status: 'all',
  flaggedOnly: false,
  sort: 'time',
  dir: 'desc',
  page: 1,
};

export const PAGE_SIZE = 20;

function oneOf<T extends string>(options: readonly T[], value: string | null): T | undefined {
  return options.find((option) => option === value);
}

/** Reads filters from the URL; anything missing or invalid falls back to the default. */
export function filtersFromParams(params: URLSearchParams): TableFilters {
  const page = Number(params.get('page'));
  return {
    query: params.get('q')?.trim() ?? DEFAULT_FILTERS.query,
    risk: oneOf(RISK_LEVELS, params.get('risk')) ?? DEFAULT_FILTERS.risk,
    status: oneOf(STATUSES, params.get('status')) ?? DEFAULT_FILTERS.status,
    flaggedOnly: params.get('flagged') === '1',
    sort: oneOf(SORT_KEYS, params.get('sort')) ?? DEFAULT_FILTERS.sort,
    dir: oneOf(['asc', 'desc'] as const, params.get('dir')) ?? DEFAULT_FILTERS.dir,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_FILTERS.page,
  };
}

/** Writes only non-default values, so the plain dashboard URL stays clean. */
export function filtersToParams(filters: TableFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.risk !== 'all') params.set('risk', filters.risk);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.flaggedOnly) params.set('flagged', '1');
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  if (filters.dir !== DEFAULT_FILTERS.dir) params.set('dir', filters.dir);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params;
}

function matchesQuery(tx: ScoredTransaction, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [tx.id, tx.accountId, tx.customerName, tx.merchant, tx.location.city].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

const SORTERS: Record<SortKey, (a: ScoredTransaction, b: ScoredTransaction) => number> = {
  time: compareChronological,
  amount: (a, b) => a.amount - b.amount,
  score: (a, b) => a.riskScore - b.riskScore,
};

/** Filters then sorts. Ties fall back to chronological order in the same direction. */
export function applyFilters(
  transactions: readonly ScoredTransaction[],
  filters: TableFilters,
): ScoredTransaction[] {
  const sign = filters.dir === 'asc' ? 1 : -1;
  const compare = SORTERS[filters.sort];
  return transactions
    .filter(
      (tx) =>
        (filters.risk === 'all' || tx.riskLevel === filters.risk) &&
        (filters.status === 'all' || tx.status === filters.status) &&
        (!filters.flaggedOnly || isFlagged(tx.riskScore)) &&
        matchesQuery(tx, filters.query),
    )
    .sort((a, b) => sign * (compare(a, b) || compareChronological(a, b)));
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
}

/** Clamps the requested page into range; an empty list still has one (empty) page. */
export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}
