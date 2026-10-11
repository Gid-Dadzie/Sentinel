import { useMemo } from 'react';
import { decisionLabels } from '../../api/review';
import type { CustomerData } from '../../api/types';
import { useApiData } from '../../api/useApiData';
import CustomerProfileView, {
  CustomerNotFound,
} from '../../components/customer/CustomerProfileView';
import { PageLoading, PageProblem } from '../../components/LoadState';
import { getCustomerProfile } from '../../utils/customer';

export default function StoredCustomerProfile({ accountId }: { accountId: string }) {
  const { data, error, reload } = useApiData<CustomerData>(
    `/api/customers/${encodeURIComponent(accountId)}`,
  );
  const profile = useMemo(
    () => (data ? getCustomerProfile(data.transactions, accountId) : null),
    [data, accountId],
  );
  const labels = useMemo(() => decisionLabels(data?.transactions ?? []), [data]);

  if (error?.status === 404) return <CustomerNotFound accountId={accountId} />;
  if (error) return <PageProblem title="Customer" error={error} onRetry={reload} />;
  if (!data || !profile) return <PageLoading title="Customer" />;

  const confirmedFraud = data.transactions.filter(
    (tx) => tx.latestDecision?.decision === 'confirmed_fraud',
  ).length;
  return (
    <CustomerProfileView profile={profile} reviewLabels={labels} confirmedFraud={confirmedFraud} />
  );
}
