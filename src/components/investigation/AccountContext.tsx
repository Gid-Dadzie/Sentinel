import { Link } from 'react-router-dom';
import { parseLocalTimestamp } from '../../engine';
import type { ScoredTransaction } from '../../types';
import { formatDateTime, formatDuration, formatMoney } from '../../utils/format';
import type { AccountBaseline } from '../../utils/investigation';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import styles from './Investigation.module.css';

const RECENT_LIMIT = 8;

function NewTag() {
  return <span className={styles.newTag}>New</span>;
}

interface Props {
  tx: ScoredTransaction;
  baseline: AccountBaseline;
}

/** What the engine knew about the customer when it scored this transaction. */
export function CustomerBaseline({ tx, baseline }: Props) {
  const { history, averageAmount, knownCountries, knownDevices, previous } = baseline;
  const hasHistory = history.length > 0;
  const minutesSincePrevious = previous
    ? (parseLocalTimestamp(tx.timestamp).ms - parseLocalTimestamp(previous.timestamp).ms) / 60_000
    : 0;

  return (
    <section className={shared.card} aria-labelledby="baseline-heading">
      <h2 id="baseline-heading" className={shared.cardTitle}>
        Customer baseline
      </h2>
      <p className={shared.cardDescription}>Built from this account’s earlier transactions only.</p>
      {hasHistory ? (
        <dl className={styles.facts}>
          <div>
            <dt>Earlier transactions</dt>
            <dd>{history.length}</dd>
          </div>
          {averageAmount !== null && (
            <div>
              <dt>Average amount</dt>
              <dd>
                {formatMoney(Math.round(averageAmount), tx.currency)}
                <span className={styles.aside}>
                  {' '}
                  (this one is {(tx.amount / averageAmount).toFixed(1)}×)
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt>Known countries</dt>
            <dd>
              {knownCountries.join(', ')}
              {!baseline.countryKnown && (
                <span className={styles.aside}>
                  {' '}
                  · this is {tx.location.country} <NewTag />
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Known devices</dt>
            <dd>
              {knownDevices.join(', ')}
              {!baseline.deviceKnown && (
                <span className={styles.aside}>
                  {' '}
                  · this is {tx.deviceId} <NewTag />
                </span>
              )}
            </dd>
          </div>
          {previous && (
            <div>
              <dt>Previous transaction</dt>
              <dd>
                <Link to={`/tx/${previous.id}`}>{previous.id}</Link> in {previous.location.city},{' '}
                {formatDuration(minutesSincePrevious)} earlier
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p>This is the first transaction on the account, so there is no baseline yet.</p>
      )}
    </section>
  );
}

/** The newest earlier transactions on the account, with this one pinned on top. */
export function RecentActivity({ tx, baseline }: Props) {
  const recent = baseline.history.slice(-RECENT_LIMIT).reverse();
  const rows = [tx, ...recent];

  return (
    <section className={shared.card} aria-labelledby="activity-heading">
      <h2 id="activity-heading" className={shared.cardTitle}>
        Recent account activity
      </h2>
      <p className={shared.cardDescription}>
        This transaction and up to {RECENT_LIMIT} before it, newest first.
      </p>
      <div className={shared.tableScroll}>
        <table className={shared.table} aria-labelledby="activity-heading">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Time</th>
              <th scope="col">Merchant</th>
              <th scope="col">Location</th>
              <th scope="col">Device</th>
              <th scope="col" className={shared.numeric}>
                Amount
              </th>
              <th scope="col">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCurrent = row.id === tx.id;
              return (
                <tr
                  key={row.id}
                  className={isCurrent ? styles.currentRow : undefined}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <th scope="row">
                    {isCurrent ? (
                      <>
                        {row.id} <span className="visually-hidden">(this transaction)</span>
                      </>
                    ) : (
                      <Link to={`/tx/${row.id}`}>{row.id}</Link>
                    )}
                  </th>
                  <td className={shared.nowrap}>{formatDateTime(row.timestamp)}</td>
                  <td>{row.merchant}</td>
                  <td>{row.location.city}</td>
                  <td className={shared.nowrap}>{row.deviceId}</td>
                  <td className={`${shared.numeric} ${shared.nowrap}`}>
                    {formatMoney(row.amount, row.currency)}
                  </td>
                  <td>
                    <RiskBadge level={row.riskLevel} score={row.riskScore} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.cardFooter}>
        <Link to={`/customer/${tx.accountId}`}>View full customer profile</Link>
      </p>
    </section>
  );
}
