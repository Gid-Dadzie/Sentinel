import { useId, useState } from 'react';
import { MAX_POINTS, MIN_POINTS } from '../../engine';
import { useFraudStore } from '../../state/useFraudStore';
import type { RuleConfig } from '../../types';
import { formatNumber } from '../../utils/format';
import { getDefaultRule, isRuleModified } from '../../utils/rules';
import styles from './Rules.module.css';

interface RuleEditorProps {
  rule: RuleConfig;
  /** Transactions this rule fires on, regardless of whether it is enabled. */
  fires: number;
}

/** One rule: on/off switch and points (slider + number box). Every change re-scores live. */
export default function RuleEditor({ rule, fires }: RuleEditorProps) {
  const updateRule = useFraudStore((state) => state.updateRule);
  const ids = { heading: useId(), condition: useId(), points: useId() };
  const defaults = getDefaultRule(rule.id);
  const modified = isRuleModified(rule);

  // The number box keeps its own text so a half-typed value ("" or "-") isn't saved as 0.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(rule.points);

  const commitText = (text: string) => {
    setDraft(text);
    const value = Number(text);
    if (text.trim() !== '' && Number.isFinite(value)) updateRule(rule.id, { points: value });
  };

  return (
    <section
      className={`${styles.rule} ${rule.enabled ? '' : styles.ruleOff}`}
      aria-labelledby={ids.heading}
    >
      <div className={styles.ruleHeader}>
        <div>
          <h2 id={ids.heading} className={styles.ruleName}>
            {rule.name}
            {modified && <span className={styles.modified}>Changed</span>}
          </h2>
          <p id={ids.condition} className={styles.condition}>
            {rule.condition}.
          </p>
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            role="switch"
            checked={rule.enabled}
            aria-describedby={ids.condition}
            onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
          />
          <span>{rule.enabled ? 'On' : 'Off'}</span>
          <span className="visually-hidden"> – {rule.name}</span>
        </label>
      </div>

      <div className={styles.pointsRow}>
        <label htmlFor={ids.points} className={styles.pointsLabel}>
          Points
        </label>
        <input
          type="range"
          min={MIN_POINTS}
          max={MAX_POINTS}
          step={1}
          value={rule.points}
          disabled={!rule.enabled}
          aria-label={`${rule.name} points slider`}
          onChange={(e) => {
            setDraft(null);
            updateRule(rule.id, { points: Number(e.target.value) });
          }}
          className={styles.slider}
        />
        <input
          id={ids.points}
          type="number"
          inputMode="numeric"
          min={MIN_POINTS}
          max={MAX_POINTS}
          step={1}
          value={shown}
          disabled={!rule.enabled}
          onChange={(e) => commitText(e.target.value)}
          onBlur={() => setDraft(null)}
          className={styles.pointsInput}
        />
      </div>

      <p className={styles.ruleFooter}>
        Fires on {formatNumber(fires)} transaction{fires === 1 ? '' : 's'}
        {modified && defaults && (
          <>
            {' '}
            · Default: {defaults.points} points, {defaults.enabled ? 'on' : 'off'}
          </>
        )}
      </p>
    </section>
  );
}
