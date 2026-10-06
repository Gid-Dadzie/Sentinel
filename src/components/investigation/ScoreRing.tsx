import type { RiskLevel } from '../../types';
import styles from './Investigation.module.css';

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Score out of 100 as a ring. The number is in the SVG; a sentence carries it for screen readers. */
export default function ScoreRing({ score, level }: { score: number; level: RiskLevel }) {
  const filled = (Math.max(0, Math.min(score, 100)) / 100) * CIRCUMFERENCE;
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} className={styles.ringTrack} />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          className={`${styles.ringFill} ${styles[`ring_${level}`]}`}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="45" className={styles.ringScore}>
          {score}
        </text>
        <text x="50" y="69" className={styles.ringMax}>
          / 100
        </text>
      </svg>
      <span className="visually-hidden">Risk score {score} out of 100.</span>
    </div>
  );
}
