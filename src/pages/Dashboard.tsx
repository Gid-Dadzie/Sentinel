import { SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import FlaggedCalendar from '../components/dashboard/FlaggedCalendar';
import styles from '../components/dashboard/Dashboard.module.css';
import ReviewQueue from '../components/dashboard/ReviewQueue';
import RiskMix from '../components/dashboard/RiskMix';
import SummaryTiles from '../components/dashboard/SummaryTiles';
import PageHeader from '../components/PageHeader';
import shared from '../components/shared.module.css';
import TransactionTable from '../components/TransactionTable';
import { useFraudStore } from '../state/useFraudStore';
import { countByRiskLevel, dailyCounts, getReviewQueue, summarize } from '../utils/dashboard';
import { formatDate, formatShortDate } from '../utils/format';

export default function Dashboard() {
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

  const first = daily[0]?.date;
  const last = daily[daily.length - 1]?.date;
  const period = first && last ? `${formatShortDate(first)} – ${formatDate(last)}` : 'No data';

  return (
    <div className={shared.page}>
      <PageHeader
        title="Dashboard"
        meta={`Every transaction is scored live against the current rules · ${period}`}
        actions={
          <Link to="/rules" className={shared.button}>
            <SlidersHorizontal size={15} aria-hidden="true" />
            Adjust rules
          </Link>
        }
      />
      <SummaryTiles summary={summary} needsReview={queue.length} period={period} />
      <div className={styles.grid}>
        <ReviewQueue queue={queue} />
        <div className={styles.side}>
          <RiskMix data={byLevel} />
          <FlaggedCalendar daily={daily} />
        </div>
      </div>
      <TransactionTable transactions={transactions} title="All transactions" />
    </div>
  );
}
