import type { RiskLevel } from '../types';
import styles from './ScoreChip.module.css';

/** Compact score square tinted by risk level. Decorative: callers also show the level in text. */
export default function ScoreChip({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <span className={`${styles.chip} ${styles[level]}`} aria-hidden="true">
      {score}
    </span>
  );
}
