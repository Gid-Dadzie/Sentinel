import { ChevronLeft, ChevronRight, ScrollText, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { DECISION_LABELS, REVIEW_STATUS_LABELS } from '../api/review';
import type { AuditEntry, AuditPage, DecisionKind, ReviewStatus } from '../api/types';
import { useApiData } from '../api/useApiData';
import { LoadProblem, PageLoading, PageProblem } from '../components/LoadState';
import PageHeader from '../components/PageHeader';
import shared from '../components/shared.module.css';
import tableStyles from '../components/TransactionTable.module.css';
import styles from './AuditLog.module.css';
import { formatNumber } from '../utils/format';
import { RULE_NAMES } from '../utils/rules';
import type { RuleId } from '../types';

const PAGE_SIZE = 25;
const FILTERS = ['action', 'actor', 'from', 'to'] as const;

const ACTION_LABELS: Record<string, string> = {
  login: 'Signed in',
  'login.failed': 'Sign-in failed',
  logout: 'Signed out',
  'user.create': 'Created user',
  'user.password_reset': 'Password reset',
  import: 'Imported file',
  decision: 'Recorded decision',
  'rule.update': 'Changed rule',
  rescore: 'Re-scored transactions',
};

const atFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

const num = (value: unknown) => (typeof value === 'number' ? formatNumber(value) : '?');
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** "points 25 → 40, on → off": only what changed. */
function ruleChange(detail: Record<string, unknown>): string {
  const before = obj(detail.before);
  const after = obj(detail.after);
  const parts: string[] = [];
  if (before.points !== after.points)
    parts.push(`points ${num(before.points)} → ${num(after.points)}`);
  if (before.enabled !== after.enabled) {
    parts.push(`${before.enabled ? 'on' : 'off'} → ${after.enabled ? 'on' : 'off'}`);
  }
  return parts.join(', ') || 'no change';
}

/** A plain-language line for each kind of entry. */
function describeEntry(entry: AuditEntry): string {
  const d = entry.detail ?? {};
  switch (entry.action) {
    case 'login.failed':
      return `Tried ${str(d.email)}`;
    case 'user.create':
      return `${str(d.email)} as ${str(d.role)}`;
    case 'import':
      return `${str(d.fileName)}: ${num(d.imported)} imported, ${num(d.flagged)} flagged, ${num(d.rejected)} rejected, ${num(d.duplicates)} duplicates`;
    case 'decision': {
      const label = DECISION_LABELS[d.decision as DecisionKind] ?? str(d.decision);
      const from = REVIEW_STATUS_LABELS[d.from as ReviewStatus] ?? str(d.from);
      const to = REVIEW_STATUS_LABELS[d.to as ReviewStatus] ?? str(d.to);
      return `${label} (${from} → ${to})`;
    }
    case 'rule.update':
      return ruleChange(d);
    case 'rescore':
      return `${num(d.changed)} of ${num(d.total)} changed; flagged ${num(d.flaggedBefore)} → ${num(d.flaggedAfter)}`;
    case 'user.password_reset':
      return 'From the server command line';
    default:
      return '';
  }
}

function Target({ entry }: { entry: AuditEntry }) {
  if (entry.entity === 'transaction' && entry.entityId) {
    return (
      <Link to={`/tx/${entry.entityId}`} className={`${shared.rowLink} mono`}>
        {entry.entityId}
      </Link>
    );
  }
  if (entry.entity === 'rule' && entry.entityId) {
    return <>{RULE_NAMES[entry.entityId as RuleId] ?? entry.entityId}</>;
  }
  if (entry.entity === 'transaction') return <>All transactions</>;
  return null; // Sign-ins and imports need no target beyond who did them.
}

/** Who did what and when. Admins only; entries can never be changed or removed. */
export default function AuditLog() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams();
  for (const key of FILTERS) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const page = Math.max(1, Number(params.get('page')) || 1);
  query.set('page', String(page));
  query.set('pageSize', String(PAGE_SIZE));
  const { data, error, reload } = useApiData<AuditPage>(`/api/audit?${query.toString()}`, {
    keepPrevious: true,
  });

  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  const filtering = FILTERS.some((key) => params.get(key));

  if (!data) {
    return error ? (
      <PageProblem title="Audit log" error={error} onRetry={reload} />
    ) : (
      <PageLoading title="Audit log" />
    );
  }

  return (
    <div className={shared.page}>
      <PageHeader
        title="Audit log"
        meta="Every sign-in, import, decision and rule change, newest first. Entries cannot be edited or deleted."
      />
      <section className={shared.card} aria-labelledby="audit-heading">
        <div className={shared.cardHead}>
          <h2 id="audit-heading" className={shared.cardTitle}>
            <ScrollText size={17} aria-hidden="true" />
            Entries
          </h2>
          <p className={tableStyles.resultCount} role="status">
            {formatNumber(data.total)} {data.total === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <form className={tableStyles.toolbar} role="search" onSubmit={(e) => e.preventDefault()}>
          <label className={tableStyles.select}>
            <span className="visually-hidden">Action</span>
            <select
              value={params.get('action') ?? ''}
              onChange={(e) => update('action', e.target.value)}
            >
              <option value="">All actions</option>
              {data.filters.actions.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
          </label>
          <label className={tableStyles.select}>
            <span className="visually-hidden">Person</span>
            <select
              value={params.get('actor') ?? ''}
              onChange={(e) => update('actor', e.target.value)}
            >
              <option value="">Everyone</option>
              {data.filters.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
          </label>
          <label className={tableStyles.field}>
            <span className={tableStyles.fieldLabel}>From</span>
            <input
              type="date"
              aria-label="From date"
              value={params.get('from') ?? ''}
              onChange={(e) => update('from', e.target.value)}
            />
          </label>
          <label className={tableStyles.field}>
            <span className={tableStyles.fieldLabel}>To</span>
            <input
              type="date"
              aria-label="To date"
              value={params.get('to') ?? ''}
              onChange={(e) => update('to', e.target.value)}
            />
          </label>
          {filtering && (
            <button
              type="button"
              className={shared.button}
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              <X size={15} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </form>

        {error && <LoadProblem error={error} onRetry={reload} />}
        <div className={shared.tableScroll}>
          <table className={`${shared.table} ${styles.table}`} aria-labelledby="audit-heading">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">On</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Time" className={`${shared.nowrap} ${shared.muted}`}>
                    <time dateTime={entry.at}>{atFormat.format(new Date(entry.at))}</time>
                  </td>
                  <td data-label="Who">
                    {entry.actor ? entry.actor.name : <span className={shared.muted}>System</span>}
                  </td>
                  <td data-label="Action">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td data-label="On">
                    <Target entry={entry} />
                  </td>
                  <td data-label="Details">{describeEntry(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && (
            <div className={shared.empty}>
              <span>No entries match these filters.</span>
            </div>
          )}
        </div>

        <nav className={tableStyles.pagination} aria-label="Pagination">
          <span className={tableStyles.range}>
            Page {data.page} of {data.pageCount}
          </span>
          <span className={tableStyles.pageControls}>
            <button
              type="button"
              className={shared.button}
              disabled={data.page <= 1}
              onClick={() => update('page', String(data.page - 1))}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              className={shared.button}
              disabled={data.page >= data.pageCount}
              onClick={() => update('page', String(data.page + 1))}
            >
              Next
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </span>
        </nav>
      </section>
    </div>
  );
}
