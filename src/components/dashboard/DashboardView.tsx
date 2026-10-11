import type { ReactNode } from 'react';
import type { ScoredTransaction } from '../../types';
import type { DailyCount, DashboardSummary, RiskLevelCount } from '../../utils/dashboard';
import { formatDate, formatShortDate } from '../../utils/format';
import PageHeader from '../PageHeader';
import shared from '../shared.module.css';
import type { ReviewLabels } from '../TransactionTable';
import styles from './Dashboard.module.css';
import FlaggedCalendar from './FlaggedCalendar';
import ReviewQueue from './ReviewQueue';
import RiskMix from './RiskMix';
import SummaryTiles from './SummaryTiles';

interface DashboardViewProps {
  /** Describes where the scores come from; the data's date range is added after it. */
  meta: string;
  actions?: ReactNode;
  summary: DashboardSummary;
  byLevel: RiskLevelCount[];
  daily: DailyCount[];
  needsReview: number;
  queue: readonly ScoredTransaction[];
  queueDescription: string;
  queueHref: string;
  reviewLabels?: ReviewLabels;
  /** The transaction table, from whichever source the page uses. */
  table: ReactNode;
}

/** The dashboard layout, shared by demo data and stored data. */
export default function DashboardView({
  meta,
  actions,
  summary,
  byLevel,
  daily,
  needsReview,
  queue,
  queueDescription,
  queueHref,
  reviewLabels,
  table,
}: DashboardViewProps) {
  const first = daily[0]?.date;
  const last = daily[daily.length - 1]?.date;
  const period = first && last ? `${formatShortDate(first)} – ${formatDate(last)}` : 'No data';

  return (
    <div className={shared.page}>
      <PageHeader title="Dashboard" meta={`${meta} · ${period}`} actions={actions} />
      <SummaryTiles summary={summary} needsReview={needsReview} period={period} />
      <div className={styles.grid}>
        <ReviewQueue
          queue={queue}
          total={needsReview}
          description={queueDescription}
          viewAllHref={queueHref}
          reviewLabels={reviewLabels}
        />
        <div className={styles.side}>
          <RiskMix data={byLevel} />
          <FlaggedCalendar daily={daily} />
        </div>
      </div>
      {table}
    </div>
  );
}
