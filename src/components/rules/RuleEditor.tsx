import { useId, useState, type ReactNode } from 'react';
import { MAX_POINTS, MIN_POINTS } from '@sentinel/engine';
import type { RuleConfig } from '../../types';
import type { RulePatch } from '../../state/useFraudStore';
import { getDefaultRule, isRuleModified } from '../../utils/rules';
import { RULE_ICONS } from '../ruleIcons';
import styles from './Rules.module.css';

interface RuleEditorProps {
  rule: RuleConfig;
  onChange: (patch: RulePatch) => void;
  /** How the rule is doing, e.g. how many transactions it fires on. */
  usage: ReactNode;
  /** Shows the settings without letting them change. */
  readOnly?: boolean;
}

/** One rule: on/off switch and points (slider + number box). */
export default function RuleEditor({ rule, onChange, usage, readOnly = false }: RuleEditorProps) {
  const ids = { heading: useId(), condition: useId(), points: useId() };
  const defaults = getDefaultRule(rule.id);
  const modified = isRuleModified(rule);
  const RuleIcon = RULE_ICONS[rule.id];

  // The number box keeps its own text so a half-typed value ("" or "-") isn't saved as 0.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(rule.points);

  const commitText = (text: string) => {
    setDraft(text);
    const value = Number(text);
    if (text.trim() !== '' && Number.isFinite(value)) onChange({ points: value });
  };

  return (
    <section
      className={`${styles.rule} ${rule.enabled ? '' : styles.ruleOff}`}
      aria-labelledby={ids.heading}
    >
      <div className={styles.ruleHeader}>
        <span className={styles.ruleIcon} aria-hidden="true">
          <RuleIcon size={18} />
        </span>
        <div className={styles.ruleTitle}>
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
            disabled={readOnly}
            aria-describedby={ids.condition}
            onChange={(e) => onChange({ enabled: e.target.checked })}
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
          disabled={readOnly || !rule.enabled}
          aria-label={`${rule.name} points slider`}
          onChange={(e) => {
            setDraft(null);
            onChange({ points: Number(e.target.value) });
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
          disabled={readOnly || !rule.enabled}
          onChange={(e) => commitText(e.target.value)}
          onBlur={() => setDraft(null)}
          className={styles.pointsInput}
        />
      </div>

      <p className={styles.ruleFooter}>
        {usage}
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
