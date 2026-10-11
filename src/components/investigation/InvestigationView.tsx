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
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { RuleConfig, ScoredTransaction } from '../../types';
import { capitalize, formatDateTime, formatMoney } from '../../utils/format';
import type { AccountBaseline } from '../../utils/investigation';
import PageHeader from '../PageHeader';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import StatusBadge from '../StatusBadge';
import { CustomerBaseline, RecentActivity } from './AccountContext';
import styles from './Investigation.module.css';
import ScoreBreakdown from './ScoreBreakdown';

export function TransactionNotFound({ id }: { id: string }) {
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

interface InvestigationViewProps {
  tx: ScoredTransaction;
  baseline: AccountBaseline;
  rules: readonly RuleConfig[];
  /** Where the analyst records a decision. */
  review: ReactNode;
  /** Extra badges beside the risk and status. */
  badges?: ReactNode;
  /** Extra rows for the details list. */
  details?: ReactNode;
}

/** The investigation page, shared by demo data and stored data. */
export default function InvestigationView({
  tx,
  baseline,
  rules,
  review,
  badges,
  details,
}: InvestigationViewProps) {
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
            {badges}
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
          <div className={styles.slotReview}>{review}</div>
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
              {details}
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
