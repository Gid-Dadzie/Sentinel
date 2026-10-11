import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_MODE } from '../api/client';
import CustomerProfileView, { CustomerNotFound } from '../components/customer/CustomerProfileView';
import { useFraudStore } from '../state/useFraudStore';
import { getCustomerProfile } from '../utils/customer';
import { verdictLabels } from '../utils/investigation';
import StoredCustomerProfile from './stored/StoredCustomerProfile';

export default function CustomerProfile() {
  const { accountId = '' } = useParams<{ accountId: string }>();
  return API_MODE ? (
    <StoredCustomerProfile accountId={accountId} />
  ) : (
    <DemoCustomerProfile accountId={accountId} />
  );
}

function DemoCustomerProfile({ accountId }: { accountId: string }) {
  const transactions = useFraudStore((state) => state.transactions);
  const reviews = useFraudStore((state) => state.reviews);
  const profile = useMemo(
    () => getCustomerProfile(transactions, accountId),
    [transactions, accountId],
  );
  const labels = useMemo(() => verdictLabels(reviews), [reviews]);

  if (!profile) return <CustomerNotFound accountId={accountId} />;
  const confirmedFraud = profile.transactions.filter(
    (tx) => reviews[tx.id]?.verdict === 'fraud',
  ).length;
  return (
    <CustomerProfileView profile={profile} reviewLabels={labels} confirmedFraud={confirmedFraud} />
  );
}
