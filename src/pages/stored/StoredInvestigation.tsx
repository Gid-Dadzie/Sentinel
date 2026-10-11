import { ArrowLeftRight, Phone } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useQueueCount } from '../../api/queueCount';
import { REVIEW_STATUS_LABELS, type SavedDecision } from '../../api/review';
import type { CustomerData, TransactionDetail, TxnType } from '../../api/types';
import { useApiData } from '../../api/useApiData';
import DecisionPanel from '../../components/investigation/DecisionPanel';
import InvestigationView, {
  TransactionNotFound,
} from '../../components/investigation/InvestigationView';
import { PageLoading, PageProblem } from '../../components/LoadState';
import shared from '../../components/shared.module.css';
import type { RuleConfig } from '../../types';
import { getAccountBaseline } from '../../utils/investigation';

const TXN_TYPE_LABELS: Record<TxnType, string> = {
  cash_in: 'Cash in',
  cash_out: 'Cash out',
  transfer: 'Transfer',
  airtime: 'Airtime',
  payment: 'Payment',
};

/** A stored transaction, its account's history, the rules, and the analyst decisions. */
export default function StoredInvestigation({ id }: { id: string }) {
  const detail = useApiData<TransactionDetail>(`/api/transactions/${encodeURIComponent(id)}`);
  const accountId = detail.data?.transaction.accountId;
  const customer = useApiData<CustomerData>(
    accountId ? `/api/customers/${encodeURIComponent(accountId)}` : null,
  );
  const rules = useApiData<{ rules: RuleConfig[] }>('/api/rules');
  const refreshQueueCount = useQueueCount((state) => state.refresh);
  const { setData } = detail;

  const tx = detail.data?.transaction;
  const baseline = useMemo(
    () => (tx && customer.data ? getAccountBaseline(customer.data.transactions, tx) : undefined),
    [tx, customer.data],
  );

  const onSaved = useCallback(
    ({ decision, reviewStatus }: SavedDecision) => {
      setData((current) => ({
        transaction: {
          ...current.transaction,
          reviewStatus,
          latestDecision: { decision: decision.decision, decidedAt: decision.decidedAt },
        },
        decisions: [decision, ...current.decisions],
      }));
      refreshQueueCount();
    },
    [setData, refreshQueueCount],
  );

  if (detail.error?.status === 404) return <TransactionNotFound id={id} />;
  const failed = [detail, customer, rules].find((d) => d.error);
  if (failed?.error) {
    return <PageProblem title="Transaction" error={failed.error} onRetry={failed.reload} />;
  }
  if (!detail.data || !tx || !baseline || !rules.data) return <PageLoading title="Transaction" />;

  return (
    <InvestigationView
      tx={tx}
      baseline={baseline}
      rules={rules.data.rules}
      badges={<span className={shared.muted}>{REVIEW_STATUS_LABELS[tx.reviewStatus]}</span>}
      details={
        <>
          <div>
            <dt>
              <ArrowLeftRight size={14} aria-hidden="true" />
              Type
            </dt>
            <dd>{TXN_TYPE_LABELS[tx.txnType]}</dd>
          </div>
          <div>
            <dt>
              <Phone size={14} aria-hidden="true" />
              Sender
            </dt>
            <dd className="mono">
              {tx.senderMsisdn}
              {tx.recipientMsisdn && <span className={shared.muted}> → {tx.recipientMsisdn}</span>}
            </dd>
          </div>
        </>
      }
      review={
        <DecisionPanel
          key={tx.id}
          transactionId={tx.id}
          reviewStatus={tx.reviewStatus}
          decisions={detail.data.decisions}
          onSaved={onSaved}
        />
      }
    />
  );
}
