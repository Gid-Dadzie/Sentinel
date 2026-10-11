import { Scale } from 'lucide-react';
import { RISK_LEVELS } from '../../types';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';

const BANDS: Record<(typeof RISK_LEVELS)[number], { range: string; decision: string }> = {
  low: { range: '0–25', decision: 'Approved' },
  medium: { range: '26–50', decision: 'Approved, flagged for attention' },
  high: { range: '51–75', decision: 'Pending manual review' },
  critical: { range: '76–100', decision: 'Declined' },
};

/** The table of score ranges, risk levels and what each means. */
export default function ScoreBands() {
  return (
    <section className={shared.card} aria-labelledby="bands-heading">
      <h2 id="bands-heading" className={shared.cardTitle}>
        <Scale size={17} aria-hidden="true" />
        How scores become decisions
      </h2>
      <p className={shared.cardDescription}>
        Points from every triggered rule are added up and capped at 100.
      </p>
      <div className={shared.tableScroll}>
        <table className={shared.table} aria-labelledby="bands-heading">
          <thead>
            <tr>
              <th scope="col">Risk level</th>
              <th scope="col">Score</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {RISK_LEVELS.map((level) => (
              <tr key={level}>
                <th scope="row">
                  <RiskBadge level={level} />
                </th>
                <td className={shared.nowrap}>{BANDS[level].range}</td>
                <td>{BANDS[level].decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
