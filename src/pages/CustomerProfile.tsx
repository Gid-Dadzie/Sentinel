import { Banknote, Flag, Receipt, SearchX, ShieldAlert, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BehaviourProfile, FlaggedTransactions } from '../components/customer/CustomerCards';
import styles from '../components/customer/Customer.module.css';
import PageHeader from '../components/PageHeader';
import RiskBadge from '../components/RiskBadge';
import shared from '../components/shared.module.css';
import StatTiles from '../components/StatTiles';
import TransactionTable from '../components/TransactionTable';
import { getRiskLevel } from '../engine';
import { useFraudStore } from '../state/useFraudStore';
import { getCustomerProfile } from '../utils/customer';
import { formatDate, formatMoney, formatNumber } from '../utils/format';

/** "John Mensah" -> "JM". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function CustomerProfile() {
  const { accountId = '' } = useParams<{ accountId: string }>();
  const transactions = useFraudStore((state) => state.transactions);
  const reviews = useFraudStore((state) => state.reviews);

  const profile = useMemo(
    () => getCustomerProfile(transactions, accountId),
    [transactions, accountId],
  );

  if (!profile) {
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

  const confirmedFraud = profile.transactions.filter(
    (tx) => reviews[tx.id]?.verdict === 'fraud',
  ).length;

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
          <span className={styles.highest}>
            Highest risk
            <RiskBadge level={getRiskLevel(profile.maxScore)} score={profile.maxScore} />
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
        <FlaggedTransactions flagged={profile.flagged} />
        <BehaviourProfile profile={profile} />
      </div>

      <TransactionTable
        transactions={profile.transactions}
        title="Transaction history"
        showCustomer={false}
      />
    </div>
  );
}
