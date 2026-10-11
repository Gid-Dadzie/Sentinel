import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { useId, useMemo, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RISK_LEVELS, STATUSES, type ScoredTransaction } from '../types';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  listCountries,
  paginate,
  parseMinAmount,
  type SortKey,
  type TableFilters,
} from '../utils/dashboard';
import { capitalize, formatDateTime, formatMoney, formatNumber } from '../utils/format';
import RiskBadge from './RiskBadge';
import shared from './shared.module.css';
import StatusBadge from './StatusBadge';
import styles from './TransactionTable.module.css';

/** URL parameters that belong to the table's own filters. */
const OWN_PARAMS = new Set([
  'q',
  'risk',
  'status',
  'country',
  'min',
  'from',
  'flagged',
  'sort',
  'dir',
  'page',
]);

const SORT_LABELS: Record<SortKey, string> = { time: 'Time', amount: 'Amount', score: 'Risk' };

/** A short review label per transaction ID, e.g. "Reviewed: fraud". */
export type ReviewLabels = Readonly<Record<string, string>>;

interface TransactionTableProps {
  transactions: readonly ScoredTransaction[];
  reviewLabels: ReviewLabels;
  title?: string;
  /** Hide the customer column when every row belongs to one customer. */
  showCustomer?: boolean;
}

/** Filters, sorts and pages a list held in the browser. */
export default function TransactionTable({ transactions, ...rest }: TransactionTableProps) {
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);
  const { items, page, pageCount } = paginate(filtered, filters.page);
  const countries = useMemo(() => listCountries(transactions), [transactions]);
  return (
    <TransactionTableView
      {...rest}
      items={items}
      matched={filtered.length}
      total={transactions.length}
      page={page}
      pageCount={pageCount}
      countries={countries}
    />
  );
}

interface TransactionTableViewProps extends Omit<TransactionTableProps, 'transactions'> {
  /** The rows on this page. */
  items: readonly ScoredTransaction[];
  /** How many transactions match the filters; null until known. */
  matched: number | null;
  /** How many there are without filters, when known. */
  total: number | null;
  page: number;
  pageCount: number;
  countries: readonly string[];
  /** Extra filters for the toolbar. */
  extraFilters?: ReactNode;
  /** True when another filter outside the URL filters is narrowing the list. */
  extraFiltering?: boolean;
  /** URL parameters of those extra filters, removed by "Clear filters". */
  extraParams?: readonly string[];
  /** Shown above the rows while loading or after an error. */
  notice?: ReactNode;
}

/** Filterable, sortable, paged table. Filters live in the page URL. On phones rows become cards. */
export function TransactionTableView({
  items,
  matched: matchedOrNull,
  total,
  page,
  pageCount,
  countries,
  reviewLabels,
  title = 'Transactions',
  showCustomer = true,
  extraFilters,
  extraFiltering = false,
  extraParams = [],
  notice,
}: TransactionTableViewProps) {
  const headingId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const searchRef = useRef<HTMLInputElement>(null);
  const minAmountRef = useRef<HTMLInputElement>(null);

  /** Keeps URL parameters the filters do not own (such as the review queue switch). */
  const setFilters = (next: TableFilters, drop: readonly string[] = []) =>
    setSearchParams(
      (current) => {
        const params = filtersToParams(next);
        for (const [key, value] of current) {
          if (!OWN_PARAMS.has(key) && !drop.includes(key)) params.set(key, value);
        }
        return params;
      },
      { replace: true },
    );
  /** Any change other than paging goes back to page 1. */
  const update = (patch: Partial<TableFilters>) => setFilters({ ...filters, page: 1, ...patch });
  const goToPage = (target: number) => setFilters({ ...filters, page: target });
  const filtering = hasActiveFilters(filters) || extraFiltering;
  /** Keeps the sort. The typed-in inputs are uncontrolled, so they are emptied directly. */
  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir }, extraParams);
    if (searchRef.current) searchRef.current.value = '';
    if (minAmountRef.current) minAmountRef.current.value = '';
  };

  const toggleSort = (key: SortKey) =>
    update({
      sort: key,
      dir: filters.sort === key && filters.dir === 'desc' ? 'asc' : 'desc',
    });

  const sortHeader = (key: SortKey, className?: string) => {
    const active = filters.sort === key;
    const SortIcon = !active ? ArrowUpDown : filters.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        className={className}
        aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`${styles.sortButton} ${active ? styles.sortActive : ''}`}
          onClick={() => toggleSort(key)}
        >
          {SORT_LABELS[key]}
          <SortIcon size={13} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const matched = matchedOrNull ?? 0;
  const firstShown = matched === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, matched);
  const countText =
    matchedOrNull === null
      ? ''
      : !filtering || total === null || matched === total
        ? `${formatNumber(matched)} ${filtering ? 'matching' : 'transactions'}`
        : `${formatNumber(matched)} of ${formatNumber(total)} transactions`;

  return (
    <section className={shared.card} aria-labelledby={headingId}>
      <div className={shared.cardHead}>
        <h2 id={headingId} className={shared.cardTitle}>
          {title}
        </h2>
        <p className={styles.resultCount} role="status">
          {countText}
        </p>
      </div>

      <form className={styles.toolbar} role="search" onSubmit={(e) => e.preventDefault()}>
        <label className={styles.search}>
          <span className="visually-hidden">Search</span>
          <Search size={16} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            placeholder={
              showCustomer ? 'Search ID, customer, merchant, city' : 'Search ID, merchant, city'
            }
            ref={searchRef}
            defaultValue={filters.query}
            onChange={(e) => update({ query: e.target.value.trim() })}
          />
        </label>
        <label className={styles.select}>
          <span className="visually-hidden">Risk level</span>
          <select
            value={filters.risk}
            onChange={(e) => update({ risk: e.target.value as TableFilters['risk'] })}
          >
            <option value="all">All risk levels</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {capitalize(level)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span className="visually-hidden">Status</span>
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as TableFilters['status'] })}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {capitalize(status)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span className="visually-hidden">Country</span>
          <select value={filters.country} onChange={(e) => update({ country: e.target.value })}>
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Min GHS</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            aria-label="Minimum amount (GHS)"
            ref={minAmountRef}
            defaultValue={filters.minAmount ?? ''}
            onChange={(e) => update({ minAmount: parseMinAmount(e.target.value) })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>From</span>
          <input
            type="date"
            aria-label="From date"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
          />
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => update({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
        {extraFilters}
        {filtering && (
          <button type="button" className={shared.button} onClick={clearFilters}>
            <X size={15} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </form>

      {notice}
      <div className={shared.tableScroll}>
        <table className={`${shared.table} ${styles.table}`} aria-labelledby={headingId}>
          <thead>
            <tr>
              <th scope="col">ID</th>
              {sortHeader('time')}
              {showCustomer && <th scope="col">Customer</th>}
              <th scope="col">Merchant</th>
              <th scope="col">Location</th>
              {sortHeader('amount', shared.numeric)}
              {sortHeader('score')}
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => {
              const review = reviewLabels[tx.id];
              return (
                <tr key={tx.id}>
                  <th scope="row" data-label="ID">
                    <Link to={`/tx/${tx.id}`} className={`${shared.rowLink} mono`}>
                      {tx.id}
                    </Link>
                  </th>
                  <td data-label="Time" className={`${shared.nowrap} ${shared.muted}`}>
                    {formatDateTime(tx.timestamp)}
                  </td>
                  {showCustomer && (
                    <td data-label="Customer">
                      <Link to={`/customer/${tx.accountId}`} className={shared.rowLink}>
                        {tx.customerName}
                      </Link>
                    </td>
                  )}
                  <td data-label="Merchant">{tx.merchant}</td>
                  <td data-label="Location" className={shared.muted}>
                    {tx.location.city}, {tx.location.country}
                  </td>
                  <td
                    data-label="Amount"
                    className={`${shared.numeric} ${shared.nowrap} ${styles.amount}`}
                  >
                    {formatMoney(tx.amount, tx.currency)}
                  </td>
                  <td data-label="Risk">
                    <RiskBadge level={tx.riskLevel} score={tx.riskScore} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={tx.status} />
                    {review && <span className={styles.review}>{review}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && !notice && (
          <div className={shared.empty}>
            <SearchX size={28} aria-hidden="true" />
            <span>No transactions match these filters. Clear a filter to see more.</span>
          </div>
        )}
      </div>

      <nav className={styles.pagination} aria-label="Pagination">
        <span className={styles.range}>
          {firstShown}–{lastShown} of {formatNumber(matched)}
        </span>
        <span className={styles.pageControls}>
          <button
            type="button"
            className={shared.button}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </button>
          <span className={styles.pageOf}>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className={shared.button}
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </span>
      </nav>
    </section>
  );
}
