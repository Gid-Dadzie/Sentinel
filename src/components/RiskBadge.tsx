import type { RiskLevel } from '../types';
import { capitalize } from '../utils/format';
import styles from './Badge.module.css';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
}

/** Colour plus a text label, so the level is never conveyed by colour alone. */
export default function RiskBadge({ level, score }: RiskBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[level]}`}>
      {capitalize(level)}
      {score === undefined ? null : ` · ${score}`}
    </span>
  );
}
