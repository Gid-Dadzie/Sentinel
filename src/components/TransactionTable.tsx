import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
} from 'lucide-react';
import { useId, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFraudStore } from '../state/useFraudStore';
import { RISK_LEVELS, STATUSES, type ScoredTransaction } from '../types';
import {
  PAGE_SIZE,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  paginate,
  type SortKey,
  type TableFilters,
} from '../utils/dashboard';
import { capitalize, formatDateTime, formatMoney, formatNumber } from '../utils/format';
import { VERDICT_SHORT_LABELS } from '../utils/investigation';
import RiskBadge from './RiskBadge';
import shared from './shared.module.css';
import StatusBadge from './StatusBadge';
import styles from './TransactionTable.module.css';

const SORT_LABELS: Record<SortKey, string> = { time: 'Time', amount: 'Amount', score: 'Risk' };

interface TransactionTableProps {
  transactions: readonly ScoredTransaction[];
  title?: string;
  /** Hide the customer column when every row belongs to one customer. */
  showCustomer?: boolean;
}

/** Filterable, sortable, paged table. Filters live in the page URL. On phones rows become cards. */
export default function TransactionTable({
  transactions,
  title = 'Transactions',
  showCustomer = true,
}: TransactionTableProps) {
  const headingId = useId();
  const reviews = useFraudStore((state) => state.reviews);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);
  const { items, page, pageCount } = paginate(filtered, filters.page);

  const setFilters = (next: TableFilters) =>
    setSearchParams(filtersToParams(next), { replace: true });
  /** Any change other than paging goes back to page 1. */
  const update = (patch: Partial<TableFilters>) => setFilters({ ...filters, page: 1, ...patch });
  const goToPage = (target: number) => setFilters({ ...filters, page: target });

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

  const firstShown = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <section className={shared.card} aria-labelledby={headingId}>
      <div className={shared.cardHead}>
        <h2 id={headingId} className={shared.cardTitle}>
          {title}
        </h2>
        <p className={styles.resultCount} role="status">
          {filtered.length === transactions.length
            ? `${formatNumber(filtered.length)} transactions`
            : `${formatNumber(filtered.length)} of ${formatNumber(transactions.length)} transactions`}
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
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => update({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
      </form>

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
              const review = reviews[tx.id];
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
                    {review && (
                      <span className={styles.review}>{VERDICT_SHORT_LABELS[review.verdict]}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className={shared.empty}>
            <SearchX size={28} aria-hidden="true" />
            <span>No transactions match these filters.</span>
          </div>
        )}
      </div>

      <nav className={styles.pagination} aria-label="Pagination">
        <span className={styles.range}>
          {firstShown}–{lastShown} of {formatNumber(filtered.length)}
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
