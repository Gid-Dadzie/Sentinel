import type { DashboardSummary } from '../../utils/dashboard';
import { formatMoney, formatNumber } from '../../utils/format';
import StatTiles from '../StatTiles';

function percent(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}

interface SummaryTilesProps {
  summary: DashboardSummary;
  /** Human-readable date range of the data, e.g. "1 Sep – 5 Oct 2026". */
  period: string;
}

export default function SummaryTiles({ summary, period }: SummaryTilesProps) {
  const tiles = [
    { label: 'Transactions', value: formatNumber(summary.total), note: period },
    {
      label: 'Flagged',
      value: formatNumber(summary.flagged),
      note: `${percent(summary.flagged, summary.total)} scored medium or above`,
    },
    {
      label: 'Pending review',
      value: formatNumber(summary.pending),
      note: 'Scored 51–75',
    },
    { label: 'Declined', value: formatNumber(summary.declined), note: 'Scored above 75' },
    {
      label: 'Flagged value',
      value: formatMoney(Math.round(summary.flaggedAmount)),
      note: 'Total amount of flagged transactions',
    },
  ];

  return <StatTiles tiles={tiles} />;
}
