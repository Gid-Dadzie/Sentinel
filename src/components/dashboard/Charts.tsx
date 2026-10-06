import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyCount, RiskLevelCount } from '../../utils/dashboard';
import { capitalize, formatDate, formatShortDate } from '../../utils/format';
import styles from './Dashboard.module.css';
import shared from '../shared.module.css';

// Recharts writes these straight onto SVG attributes, so CSS variables keep both themes working.
const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 };
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text)', fontWeight: 600 },
  itemStyle: { color: 'var(--text)' },
};

interface ChartCardProps {
  title: string;
  description: string;
  /** Accessible fallback: the same numbers as a table. */
  table: ReactNode;
  children: ReactNode;
}

function ChartCard({ title, description, table, children }: ChartCardProps) {
  return (
    <figure className={shared.card}>
      <figcaption>
        <h2 className={shared.cardTitle}>{title}</h2>
        <p className={shared.cardDescription}>{description}</p>
      </figcaption>
      <div className={styles.chart} aria-hidden="true">
        {children}
      </div>
      <details className={styles.dataTable}>
        <summary>View as table</summary>
        {table}
      </details>
    </figure>
  );
}

export function RiskDistributionChart({ data }: { data: RiskLevelCount[] }) {
  const rows = data.map((d) => ({ ...d, label: capitalize(d.level) }));
  return (
    <ChartCard
      title="Transactions by risk level"
      description="How many transactions fall into each risk band with the current rules."
      table={
        <table>
          <thead>
            <tr>
              <th scope="col">Risk level</th>
              <th scope="col">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.level}>
                <th scope="row">{row.label}</th>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip
            {...TOOLTIP_PROPS}
            cursor={{ fill: 'var(--surface-2)' }}
            formatter={(value) => [value, 'Transactions']}
          />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          >
            <LabelList dataKey="count" position="top" fill="var(--text)" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DailyFlaggedChart({ data }: { data: DailyCount[] }) {
  return (
    <ChartCard
      title="Flagged transactions per day"
      description="Transactions scored medium risk or above, by day."
      table={
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Flagged</th>
              <th scope="col">All transactions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatDate(day.date)}</th>
                <td>{day.flagged}</td>
                <td>{day.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip
            {...TOOLTIP_PROPS}
            cursor={{ stroke: 'var(--text-muted)', strokeDasharray: '3 3' }}
            labelFormatter={(date: string) => formatDate(date)}
            formatter={(value, _name, item) => [
              `${value} of ${(item.payload as DailyCount).total}`,
              'Flagged',
            ]}
          />
          <Line
            type="linear"
            dataKey="flagged"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
