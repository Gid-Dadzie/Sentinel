import {
  Banknote,
  CalendarClock,
  FileText,
  MapPin,
  SearchX,
  Smartphone,
  Store,
  UserRound,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerBaseline, RecentActivity } from '../components/investigation/AccountContext';
import styles from '../components/investigation/Investigation.module.css';
import ReviewPanel from '../components/investigation/ReviewPanel';
import ScoreBreakdown from '../components/investigation/ScoreBreakdown';
import PageHeader from '../components/PageHeader';
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
        <PageHeader title="Transaction not found" crumbs={[{ label: 'Dashboard', to: '/' }]} />
        <div className={`${shared.card} ${shared.empty}`}>
          <SearchX size={28} aria-hidden="true" />
          <p>There is no transaction with ID “{id}”.</p>
          <Link to="/" className={shared.button}>
            Back to the dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <PageHeader
        crumbs={[
          { label: 'Dashboard', to: '/' },
          { label: tx.customerName, to: `/customer/${tx.accountId}` },
        ]}
        title={
          <>
            Transaction <span className="mono">{tx.id}</span>
          </>
        }
        meta={
          <>
            <strong className={styles.heroAmount}>{formatMoney(tx.amount, tx.currency)}</strong> at{' '}
            {tx.merchant} · {formatDateTime(tx.timestamp)}
          </>
        }
        actions={
          <>
            <RiskBadge level={tx.riskLevel} score={tx.riskScore} />
            <StatusBadge status={tx.status} />
          </>
        }
      />

      <div className={styles.layout}>
        <div className={styles.column}>
          <div className={styles.slotScore}>
            <ScoreBreakdown tx={tx} rules={rules} />
          </div>
          <div className={styles.slotActivity}>
            <RecentActivity tx={tx} baseline={baseline} />
          </div>
        </div>
        <div className={styles.column}>
          <div className={styles.slotReview}>
            <ReviewPanel key={tx.id} transactionId={tx.id} />
          </div>
          <section
            className={`${shared.card} ${styles.slotDetails}`}
            aria-labelledby="details-heading"
          >
            <h2 id="details-heading" className={shared.cardTitle}>
              <FileText size={17} aria-hidden="true" />
              Details
            </h2>
            <dl className={shared.facts}>
              <div>
                <dt>
                  <UserRound size={14} aria-hidden="true" />
                  Customer
                </dt>
                <dd>
                  <Link to={`/customer/${tx.accountId}`}>{tx.customerName}</Link>{' '}
                  <span className={`${shared.muted} mono`}>{tx.accountId}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <Banknote size={14} aria-hidden="true" />
                  Amount
                </dt>
                <dd>{formatMoney(tx.amount, tx.currency)}</dd>
              </div>
              <div>
                <dt>
                  <Store size={14} aria-hidden="true" />
                  Merchant
                </dt>
                <dd>
                  {tx.merchant} <span className={shared.muted}>· {capitalize(tx.category)}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={14} aria-hidden="true" />
                  Location
                </dt>
                <dd>
                  {tx.location.city}, {tx.location.country}
                </dd>
              </div>
              <div>
                <dt>
                  <Smartphone size={14} aria-hidden="true" />
                  Device
                </dt>
                <dd className="mono">{tx.deviceId}</dd>
              </div>
              <div>
                <dt>
                  <CalendarClock size={14} aria-hidden="true" />
                  Time
                </dt>
                <dd>{formatDateTime(tx.timestamp)}</dd>
              </div>
            </dl>
          </section>
          <div className={styles.slotBaseline}>
            <CustomerBaseline tx={tx} baseline={baseline} />
          </div>
        </div>
      </div>
    </div>
  );
}
