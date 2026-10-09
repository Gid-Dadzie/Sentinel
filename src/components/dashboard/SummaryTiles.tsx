import { Ban, Banknote, Flag, Inbox, Receipt } from 'lucide-react';
import type { DashboardSummary } from '../../utils/dashboard';
import { formatMoney, formatNumber } from '../../utils/format';
import StatTiles from '../StatTiles';

function percent(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}

interface SummaryTilesProps {
  summary: DashboardSummary;
  needsReview: number;
  /** Human-readable date range of the data, e.g. "1 Sep – 5 Oct 2026". */
  period: string;
}

export default function SummaryTiles({ summary, needsReview, period }: SummaryTilesProps) {
  return (
    <StatTiles
      tiles={[
        {
          label: 'Needs review',
          value: formatNumber(needsReview),
          note: needsReview === 0 ? 'Queue is clear' : 'Flagged, no verdict yet',
          icon: Inbox,
          tone: 'action',
        },
        {
          label: 'Transactions',
          value: formatNumber(summary.total),
          note: `${formatMoney(Math.round(summary.totalAmount))} total · ${period}`,
          icon: Receipt,
        },
        {
          label: 'Flagged',
          value: formatNumber(summary.flagged),
          note: `${percent(summary.flagged, summary.total)} scored medium or above`,
          icon: Flag,
        },
        {
          label: 'Declined',
          value: formatNumber(summary.declined),
          note: `${formatNumber(summary.pending)} more pending (51–75)`,
          icon: Ban,
        },
        {
          label: 'Flagged value',
          value: formatMoney(Math.round(summary.flaggedAmount)),
          note: 'Total of flagged amounts',
          icon: Banknote,
        },
      ]}
    />
  );
}
