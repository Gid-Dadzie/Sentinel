import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BehaviourProfile, FlaggedTransactions } from '../components/customer/CustomerCards';
import styles from '../components/customer/Customer.module.css';
import RiskBadge from '../components/RiskBadge';
import shared from '../components/shared.module.css';
import StatTiles from '../components/StatTiles';
import TransactionTable from '../components/TransactionTable';
import { getRiskLevel } from '../engine';
import { useFraudStore } from '../state/useFraudStore';
import { getCustomerProfile } from '../utils/customer';
import { formatDate, formatMoney, formatNumber } from '../utils/format';

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
        <div className={shared.intro}>
          <h1>Customer not found</h1>
          <p>There is no customer with account ID “{accountId}”.</p>
        </div>
        <p>
          <Link to="/">Back to the dashboard</Link>
        </p>
      </div>
    );
  }

  const confirmedFraud = profile.transactions.filter(
    (tx) => reviews[tx.id]?.verdict === 'fraud',
  ).length;

  return (
    <div className={shared.page}>
      <div>
        <Link to="/" className={styles.back}>
          ← Dashboard
        </Link>
        <div className={styles.header}>
          <div>
            <h1>{profile.name}</h1>
            <p className={styles.headerMeta}>
              {profile.accountId} · active {formatDate(profile.firstSeen)} –{' '}
              {formatDate(profile.lastSeen)}
            </p>
          </div>
          <div className={styles.highest}>
            <span>Highest risk</span>
            <RiskBadge level={getRiskLevel(profile.maxScore)} score={profile.maxScore} />
          </div>
        </div>
      </div>

      <StatTiles
        tiles={[
          { label: 'Transactions', value: formatNumber(profile.transactions.length) },
          {
            label: 'Total spent',
            value: formatMoney(Math.round(profile.totalAmount)),
          },
          {
            label: 'Average amount',
            value: formatMoney(Math.round(profile.averageAmount)),
          },
          {
            label: 'Flagged',
            value: formatNumber(profile.flagged.length),
            note: `Highest score ${profile.maxScore}`,
          },
          {
            label: 'Confirmed fraud',
            value: formatNumber(confirmedFraud),
            note: 'From analyst reviews',
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
