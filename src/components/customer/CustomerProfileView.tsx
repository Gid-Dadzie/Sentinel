import { Banknote, Flag, Receipt, SearchX, ShieldAlert, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRiskLevel } from '@sentinel/engine';
import { CURRENT_RISK_WINDOW, type CustomerProfile } from '../../utils/customer';
import { formatDate, formatMoney, formatNumber } from '../../utils/format';
import PageHeader from '../PageHeader';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import StatTiles from '../StatTiles';
import TransactionTable, { type ReviewLabels } from '../TransactionTable';
import styles from './Customer.module.css';
import { BehaviourProfile, FlaggedTransactions } from './CustomerCards';

/** "John Mensah" -> "JM". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function CustomerNotFound({ accountId }: { accountId: string }) {
  return (
    <div className={shared.page}>
      <PageHeader title="Customer not found" crumbs={[{ label: 'Dashboard', to: '/' }]} />
      <div className={`${shared.card} ${shared.empty}`}>
        <SearchX size={28} aria-hidden="true" />
        <p>There is no customer with account ID “{accountId}”.</p>
        <Link to="/" className={shared.button}>
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}

interface CustomerProfileViewProps {
  profile: CustomerProfile;
  reviewLabels: ReviewLabels;
  /** Transactions an analyst has confirmed as fraud. */
  confirmedFraud: number;
}

/** The customer page, shared by demo data and stored data. */
export default function CustomerProfileView({
  profile,
  reviewLabels,
  confirmedFraud,
}: CustomerProfileViewProps) {
  return (
    <div className={shared.page}>
      <PageHeader
        crumbs={[{ label: 'Dashboard', to: '/' }]}
        title={
          <>
            <span className={styles.avatar} aria-hidden="true">
              {initials(profile.name)}
            </span>
            {profile.name}
          </>
        }
        meta={`${profile.accountId} · active ${formatDate(profile.firstSeen)} – ${formatDate(profile.lastSeen)}`}
        actions={
          <span
            className={styles.highest}
            title={`Average score of the last ${CURRENT_RISK_WINDOW} transactions`}
          >
            Current risk
            <RiskBadge level={getRiskLevel(profile.currentScore)} score={profile.currentScore} />
          </span>
        }
      />

      <StatTiles
        tiles={[
          {
            label: 'Transactions',
            value: formatNumber(profile.transactions.length),
            icon: Receipt,
          },
          {
            label: 'Total spent',
            value: formatMoney(Math.round(profile.totalAmount)),
            icon: Wallet,
          },
          {
            label: 'Average amount',
            value: formatMoney(Math.round(profile.averageAmount)),
            note: `Largest ${formatMoney(Math.round(profile.largestAmount))}`,
            icon: Banknote,
          },
          {
            label: 'Flagged',
            value: formatNumber(profile.flagged.length),
            note: `Highest score ${profile.maxScore}`,
            icon: Flag,
            tone: profile.flagged.length > 0 ? 'action' : 'default',
          },
          {
            label: 'Confirmed fraud',
            value: formatNumber(confirmedFraud),
            note: 'From analyst reviews',
            icon: ShieldAlert,
          },
        ]}
      />

      <div className={styles.layout}>
        <FlaggedTransactions flagged={profile.flagged} reviewLabels={reviewLabels} />
        <BehaviourProfile profile={profile} />
      </div>

      <TransactionTable
        transactions={profile.transactions}
        reviewLabels={reviewLabels}
        title="Transaction history"
        showCustomer={false}
      />
    </div>
  );
}
