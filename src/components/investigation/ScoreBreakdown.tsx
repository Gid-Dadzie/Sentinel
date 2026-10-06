import { Link } from 'react-router-dom';
import type { RuleConfig, ScoredTransaction } from '../../types';
import { getRuleOutcomes, uncappedTotal, type RuleOutcome } from '../../utils/investigation';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import styles from './Investigation.module.css';

function OutcomeRow({ outcome }: { outcome: RuleOutcome }) {
  const { rule } = outcome;
  switch (outcome.state) {
    case 'triggered':
      return (
        <li className={styles.outcome}>
          <span className={`${styles.points} ${styles.pointsOn}`}>+{outcome.reason.points}</span>
          <div>
            <strong>{rule.name}</strong>
            <p className={styles.outcomeText}>{outcome.reason.text}</p>
          </div>
        </li>
      );
    case 'clear':
      return (
        <li className={`${styles.outcome} ${styles.muted}`}>
          <span className={styles.points}>0</span>
          <div>
            {rule.name}
            <p className={styles.outcomeText}>Not triggered. Checks: {rule.condition}.</p>
          </div>
        </li>
      );
    case 'disabled':
      return (
        <li className={`${styles.outcome} ${styles.muted}`}>
          <span className={styles.points}>Off</span>
          <div>
            {rule.name}
            <p className={styles.outcomeText}>Rule is turned off, so it was not checked.</p>
          </div>
        </li>
      );
  }
}

interface ScoreBreakdownProps {
  tx: ScoredTransaction;
  rules: readonly RuleConfig[];
}

export default function ScoreBreakdown({ tx, rules }: ScoreBreakdownProps) {
  const outcomes = getRuleOutcomes(rules, tx.fraudReasons);
  const total = uncappedTotal(tx.fraudReasons);

  return (
    <section className={shared.card} aria-labelledby="score-heading">
      <h2 id="score-heading" className={shared.cardTitle}>
        Why this score
      </h2>
      <div className={styles.scoreRow}>
        <p className={styles.score}>
          {tx.riskScore}
          <span className={styles.scoreMax}> / 100</span>
        </p>
        <RiskBadge level={tx.riskLevel} />
      </div>
      <div className={styles.meter} aria-hidden="true">
        <div
          className={`${styles.meterFill} ${styles[tx.riskLevel]}`}
          style={{ width: `${tx.riskScore}%` }}
        />
      </div>
      {total > tx.riskScore && (
        <p className={shared.cardDescription}>
          Triggered rules add up to {total} points; the score is capped at 100.
        </p>
      )}
      {tx.fraudReasons.length === 0 && (
        <p className={shared.cardDescription}>No enabled rule was triggered.</p>
      )}
      <ol className={styles.outcomes} aria-label="Rule results">
        {outcomes.map((outcome) => (
          <OutcomeRow key={outcome.rule.id} outcome={outcome} />
        ))}
      </ol>
      <p className={styles.cardFooter}>
        <Link to="/rules">Adjust rule weights</Link>
      </p>
    </section>
  );
}
