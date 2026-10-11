import { SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API_MODE } from '../api/client';
import DashboardView from '../components/dashboard/DashboardView';
import shared from '../components/shared.module.css';
import TransactionTable from '../components/TransactionTable';
import { useFraudStore } from '../state/useFraudStore';
import { countByRiskLevel, dailyCounts, getReviewQueue, summarize } from '../utils/dashboard';
import { verdictLabels } from '../utils/investigation';
import StoredDashboard from './stored/StoredDashboard';

export default function Dashboard() {
  return API_MODE ? <StoredDashboard /> : <DemoDashboard />;
}

/** Generated data, scored live in the browser. */
function DemoDashboard() {
  const transactions = useFraudStore((state) => state.transactions);
  const reviews = useFraudStore((state) => state.reviews);

  const { summary, byLevel, daily } = useMemo(
    () => ({
      summary: summarize(transactions),
      byLevel: countByRiskLevel(transactions),
      daily: dailyCounts(transactions),
    }),
    [transactions],
  );
  const queue = useMemo(() => getReviewQueue(transactions, reviews), [transactions, reviews]);
  const labels = useMemo(() => verdictLabels(reviews), [reviews]);

  return (
    <DashboardView
      meta="Every transaction is scored live against the current rules"
      actions={
        <Link to="/rules" className={shared.button}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          Adjust rules
        </Link>
      }
      summary={summary}
      byLevel={byLevel}
      daily={daily}
      needsReview={queue.length}
      queue={queue}
      queueDescription="Flagged transactions without an analyst verdict, riskiest first."
      queueHref="/?flagged=1&sort=score"
      table={
        <TransactionTable
          transactions={transactions}
          reviewLabels={labels}
          title="All transactions"
        />
      }
    />
  );
}
