import { PieChart } from 'lucide-react';
import type { RiskLevelCount } from '../../utils/dashboard';
import { capitalize, formatNumber } from '../../utils/format';
import shared from '../shared.module.css';
import styles from './Dashboard.module.css';

function percent(count: number, total: number): string {
  if (total === 0 || count === 0) return '0%';
  const value = (count / total) * 100;
  return value < 1 ? '<1%' : `${Math.round(value)}%`;
}

/** Share of transactions per risk band: one proportional bar plus an exact legend. */
export default function RiskMix({ data }: { data: RiskLevelCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className={shared.card} aria-labelledby="mix-heading">
      <h2 id="mix-heading" className={shared.cardTitle}>
        <PieChart size={17} aria-hidden="true" />
        Risk mix
      </h2>
      <p className={shared.cardDescription}>
        All {formatNumber(total)} transactions by risk band, with the current rules.
      </p>
      <div className={styles.mixBar} aria-hidden="true">
        {data
          .filter((d) => d.count > 0)
          .map((d) => (
            <span
              key={d.level}
              className={styles[`seg_${d.level}`]}
              style={{ flexGrow: d.count }}
              title={`${capitalize(d.level)}: ${d.count}`}
            />
          ))}
      </div>
      <ul className={styles.mixLegend} aria-label="Transactions per risk band">
        {data.map((d) => (
          <li key={d.level}>
            <span
              className={`${styles.mixSwatch} ${styles[`seg_${d.level}`]}`}
              aria-hidden="true"
            />
            <span className={styles.mixLabel}>{capitalize(d.level)}</span>
            <span className={styles.mixCount}>{formatNumber(d.count)}</span>
            <span className={styles.mixPct}>{percent(d.count, total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
