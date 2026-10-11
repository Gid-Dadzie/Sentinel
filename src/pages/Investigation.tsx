import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_MODE } from '../api/client';
import InvestigationView, {
  TransactionNotFound,
} from '../components/investigation/InvestigationView';
import ReviewPanel from '../components/investigation/ReviewPanel';
import { useFraudStore } from '../state/useFraudStore';
import { getAccountBaseline } from '../utils/investigation';
import StoredInvestigation from './stored/StoredInvestigation';

export default function Investigation() {
  const { id = '' } = useParams<{ id: string }>();
  return API_MODE ? <StoredInvestigation id={id} /> : <DemoInvestigation id={id} />;
}

function DemoInvestigation({ id }: { id: string }) {
  const transactions = useFraudStore((state) => state.transactions);
  const rules = useFraudStore((state) => state.rules);

  const tx = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);
  const baseline = useMemo(
    () => (tx ? getAccountBaseline(transactions, tx) : undefined),
    [transactions, tx],
  );

  if (!tx || !baseline) return <TransactionNotFound id={id} />;
  return (
    <InvestigationView
      tx={tx}
      baseline={baseline}
      rules={rules}
      review={<ReviewPanel key={tx.id} transactionId={tx.id} />}
    />
  );
}
