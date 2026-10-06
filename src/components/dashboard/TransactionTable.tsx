import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RISK_LEVELS, STATUSES, type ScoredTransaction } from '../../types';
import {
  applyFilters,
  filtersFromParams,
  filtersToParams,
  paginate,
  type SortKey,
  type TableFilters,
} from '../../utils/dashboard';
import { capitalize, formatDateTime, formatMoney, formatNumber } from '../../utils/format';
import RiskBadge from '../RiskBadge';
import StatusBadge from '../StatusBadge';
import styles from './Dashboard.module.css';

const SORT_LABELS: Record<SortKey, string> = { time: 'Time', amount: 'Amount', score: 'Risk' };

export default function TransactionTable({
  transactions,
}: {
  transactions: readonly ScoredTransaction[];
}) {
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
    return (
      <th
        scope="col"
        className={className}
        aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className={styles.sortButton} onClick={() => toggleSort(key)}>
          {SORT_LABELS[key]}
          <span aria-hidden="true" className={styles.sortIcon}>
            {active ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className={styles.cardTitle}>
        Transactions
      </h2>

      <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            type="search"
            placeholder="ID, customer, merchant, city"
            defaultValue={filters.query}
            onChange={(e) => update({ query: e.target.value.trim() })}
          />
        </label>
        <label className={styles.field}>
          <span>Risk level</span>
          <select
            value={filters.risk}
            onChange={(e) => update({ risk: e.target.value as TableFilters['risk'] })}
          >
            <option value="all">All levels</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {capitalize(level)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
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
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => update({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
      </form>

      <p className={styles.resultCount} role="status">
        {filtered.length === transactions.length
          ? `${formatNumber(filtered.length)} transactions`
          : `${formatNumber(filtered.length)} of ${formatNumber(transactions.length)} transactions`}
      </p>

      <div className={styles.tableScroll}>
        <table className={styles.table} aria-labelledby="transactions-heading">
          <thead>
            <tr>
              <th scope="col">ID</th>
              {sortHeader('time')}
              <th scope="col">Customer</th>
              <th scope="col">Merchant</th>
              <th scope="col">Location</th>
              {sortHeader('amount', styles.numeric)}
              {sortHeader('score')}
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => (
              <tr key={tx.id}>
                <th scope="row">
                  <Link to={`/tx/${tx.id}`}>{tx.id}</Link>
                </th>
                <td className={styles.nowrap}>{formatDateTime(tx.timestamp)}</td>
                <td>
                  <Link to={`/customer/${tx.accountId}`}>{tx.customerName}</Link>
                </td>
                <td>{tx.merchant}</td>
                <td>
                  {tx.location.city}, {tx.location.country}
                </td>
                <td className={`${styles.numeric} ${styles.nowrap}`}>
                  {formatMoney(tx.amount, tx.currency)}
                </td>
                <td>
                  <RiskBadge level={tx.riskLevel} score={tx.riskScore} />
                </td>
                <td>
                  <StatusBadge status={tx.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className={styles.empty}>No transactions match these filters.</p>}
      </div>

      <nav className={styles.pagination} aria-label="Pagination">
        <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
          Next
        </button>
      </nav>
    </section>
  );
}
