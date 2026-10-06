import { useMemo } from 'react';
import { DailyFlaggedChart, RiskDistributionChart } from '../components/dashboard/Charts';
import styles from '../components/dashboard/Dashboard.module.css';
import SummaryTiles from '../components/dashboard/SummaryTiles';
import TransactionTable from '../components/dashboard/TransactionTable';
import { useFraudStore } from '../state/useFraudStore';
import { countByRiskLevel, dailyCounts, summarize } from '../utils/dashboard';
import { formatDate, formatShortDate } from '../utils/format';

export default function Dashboard() {
  const transactions = useFraudStore((state) => state.transactions);

  const { summary, byLevel, daily } = useMemo(
    () => ({
      summary: summarize(transactions),
      byLevel: countByRiskLevel(transactions),
      daily: dailyCounts(transactions),
    }),
    [transactions],
  );

  const first = daily[0]?.date;
  const last = daily[daily.length - 1]?.date;
  const period = first && last ? `${formatShortDate(first)} – ${formatDate(last)}` : 'No data';

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1>Dashboard</h1>
        <p>Every transaction is scored live against the current rules.</p>
      </div>
      <SummaryTiles summary={summary} period={period} />
      <div className={styles.charts}>
        <RiskDistributionChart data={byLevel} />
        <DailyFlaggedChart data={daily} />
      </div>
      <TransactionTable transactions={transactions} />
    </div>
  );
}
