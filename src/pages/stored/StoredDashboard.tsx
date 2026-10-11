import { Inbox, SlidersHorizontal, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalUser } from '../../api/auth';
import { decisionLabels } from '../../api/review';
import type { DashboardData } from '../../api/types';
import { useApiData } from '../../api/useApiData';
import ApiTransactionTable, { QUEUE_PARAM } from '../../components/ApiTransactionTable';
import DashboardView from '../../components/dashboard/DashboardView';
import { PageLoading, PageProblem } from '../../components/LoadState';
import PageHeader from '../../components/PageHeader';
import shared from '../../components/shared.module.css';

/** Stored transactions, scored when they were imported. */
export default function StoredDashboard() {
  const { data, error, reload } = useApiData<DashboardData>('/api/dashboard');
  const labels = useMemo(() => decisionLabels(data?.queue ?? []), [data]);

  if (!data) {
    return error ? (
      <PageProblem title="Dashboard" error={error} onRetry={reload} />
    ) : (
      <PageLoading title="Dashboard" />
    );
  }
  if (data.summary.total === 0) return <NothingImported />;

  return (
    <DashboardView
      meta="Scored when imported, with the rules at that time"
      actions={
        <Link to="/rules" className={shared.button}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          View rules
        </Link>
      }
      summary={data.summary}
      byLevel={data.byLevel}
      daily={data.daily}
      needsReview={data.needsReview}
      queue={data.queue}
      queueDescription="Flagged transactions that are not resolved yet, riskiest first."
      queueHref={`/?${QUEUE_PARAM}=1&sort=score`}
      reviewLabels={labels}
      table={
        <ApiTransactionTable
          title="All transactions"
          countries={data.countries}
          total={data.summary.total}
        />
      }
    />
  );
}

function NothingImported() {
  const isAdmin = useOptionalUser()?.role === 'admin';
  return (
    <div className={shared.page}>
      <PageHeader title="Dashboard" />
      <div className={`${shared.card} ${shared.empty}`}>
        <Inbox size={28} aria-hidden="true" />
        <strong>No transactions yet</strong>
        <span>
          {isAdmin
            ? 'Import a CSV or Excel file to start reviewing.'
            : 'An admin needs to import transactions before there is anything to review.'}
        </span>
        {isAdmin && (
          <Link to="/import" className={shared.buttonPrimary}>
            <Upload size={15} aria-hidden="true" />
            Import transactions
          </Link>
        )}
      </div>
    </div>
  );
}
