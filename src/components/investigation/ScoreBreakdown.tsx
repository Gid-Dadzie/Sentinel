import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RuleConfig, ScoredTransaction, Status } from '../../types';
import { getRuleOutcomes, uncappedTotal, type RuleOutcome } from '../../utils/investigation';
import RiskBadge from '../RiskBadge';
import { RULE_ICONS } from '../ruleIcons';
import shared from '../shared.module.css';
import styles from './Investigation.module.css';
import ScoreRing from './ScoreRing';

const DECISIONS: Record<Status, string> = {
  approved: 'Approved automatically',
  pending: 'Held for manual review',
  declined: 'Declined automatically',
};

function OutcomeRow({ outcome }: { outcome: RuleOutcome }) {
  const { rule } = outcome;
  const Icon = RULE_ICONS[rule.id];
  const on = outcome.state === 'triggered';
  return (
    <li className={`${styles.outcome} ${on ? styles.outcomeOn : styles.outcomeOff}`}>
      <span className={styles.outcomeIcon} aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className={styles.outcomeBody}>
        <span className={styles.outcomeName}>{rule.name}</span>
        <p className={styles.outcomeText}>
          {outcome.state === 'triggered' && outcome.reason.text}
          {outcome.state === 'clear' && <>Not triggered. Checks: {rule.condition}.</>}
          {outcome.state === 'disabled' && 'Rule is turned off, so it was not checked.'}
        </p>
      </div>
      <span className={`${styles.points} ${on ? styles.pointsOn : ''}`}>
        {outcome.state === 'triggered' && `+${outcome.reason.points}`}
        {outcome.state === 'clear' && '0'}
        {outcome.state === 'disabled' && 'Off'}
      </span>
    </li>
  );
}

interface ScoreBreakdownProps {
  tx: ScoredTransaction;
  rules: readonly RuleConfig[];
}

export default function ScoreBreakdown({ tx, rules }: ScoreBreakdownProps) {
  const outcomes = getRuleOutcomes(rules, tx.fraudReasons);
  const total = uncappedTotal(tx.fraudReasons);
  const fired = tx.fraudReasons.length;

  return (
    <section className={shared.card} aria-labelledby="score-heading">
      <div className={shared.cardHead}>
        <h2 id="score-heading" className={shared.cardTitle}>
          <Sparkles size={17} aria-hidden="true" />
          Why this score
        </h2>
        <Link to="/rules" className={shared.buttonGhost}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          Adjust rules
        </Link>
      </div>

      <div className={styles.scoreSummary}>
        <ScoreRing score={tx.riskScore} level={tx.riskLevel} />
        <div className={styles.scoreFacts}>
          <RiskBadge level={tx.riskLevel} />
          <p className={styles.decision}>{DECISIONS[tx.status]}</p>
          <p className={shared.cardDescription}>
            {fired === 0
              ? 'No enabled rule was triggered.'
              : `${fired} of ${rules.filter((r) => r.enabled).length} enabled rules triggered.`}
            {total > tx.riskScore &&
              ` Triggered rules add up to ${total} points; the score is capped at 100.`}
          </p>
        </div>
      </div>

      <ol className={styles.outcomes} aria-label="Rule results">
        {outcomes.map((outcome) => (
          <OutcomeRow key={outcome.rule.id} outcome={outcome} />
        ))}
      </ol>
    </section>
  );
}
