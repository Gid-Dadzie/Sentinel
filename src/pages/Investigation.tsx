import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerBaseline, RecentActivity } from '../components/investigation/AccountContext';
import styles from '../components/investigation/Investigation.module.css';
import ReviewPanel from '../components/investigation/ReviewPanel';
import ScoreBreakdown from '../components/investigation/ScoreBreakdown';
import RiskBadge from '../components/RiskBadge';
import shared from '../components/shared.module.css';
import StatusBadge from '../components/StatusBadge';
import { useFraudStore } from '../state/useFraudStore';
import { capitalize, formatDateTime, formatMoney } from '../utils/format';
import { getAccountBaseline } from '../utils/investigation';

export default function Investigation() {
  const { id } = useParams<{ id: string }>();
  const transactions = useFraudStore((state) => state.transactions);
  const rules = useFraudStore((state) => state.rules);

  const tx = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);
  const baseline = useMemo(
    () => (tx ? getAccountBaseline(transactions, tx) : undefined),
    [transactions, tx],
  );

  if (!tx || !baseline) {
    return (
      <div className={shared.page}>
        <div className={shared.intro}>
          <h1>Transaction not found</h1>
          <p>There is no transaction with ID “{id}”.</p>
        </div>
        <p>
          <Link to="/">Back to the dashboard</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <div>
        <Link to="/" className={styles.back}>
          ← Dashboard
        </Link>
        <div className={styles.header}>
          <div>
            <h1>Transaction {tx.id}</h1>
            <p className={styles.headerMeta}>
              {formatMoney(tx.amount, tx.currency)} at {tx.merchant} ·{' '}
              {formatDateTime(tx.timestamp)}
            </p>
          </div>
          <div className={styles.headerBadges}>
            <RiskBadge level={tx.riskLevel} score={tx.riskScore} />
            <StatusBadge status={tx.status} />
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.column}>
          <ScoreBreakdown tx={tx} rules={rules} />
          <RecentActivity tx={tx} baseline={baseline} />
        </div>
        <div className={styles.column}>
          <section className={shared.card} aria-labelledby="details-heading">
            <h2 id="details-heading" className={shared.cardTitle}>
              Details
            </h2>
            <dl className={styles.facts}>
              <div>
                <dt>Customer</dt>
                <dd>
                  <Link to={`/customer/${tx.accountId}`}>{tx.customerName}</Link> ({tx.accountId})
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatMoney(tx.amount, tx.currency)}</dd>
              </div>
              <div>
                <dt>Merchant</dt>
                <dd>
                  {tx.merchant} <span className={styles.aside}>({capitalize(tx.category)})</span>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {tx.location.city}, {tx.location.country}
                </dd>
              </div>
              <div>
                <dt>Device</dt>
                <dd>{tx.deviceId}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{formatDateTime(tx.timestamp)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{capitalize(tx.status)} (set automatically from the score)</dd>
              </div>
            </dl>
          </section>
          <CustomerBaseline tx={tx} baseline={baseline} />
          <ReviewPanel key={tx.id} transactionId={tx.id} />
        </div>
      </div>
    </div>
  );
}
