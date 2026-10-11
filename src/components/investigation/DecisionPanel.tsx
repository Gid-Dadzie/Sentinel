import { CircleHelp, Gavel, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useAuth } from '../../api/auth';
import { ApiError } from '../../api/client';
import {
  DECISION_LABELS,
  REVIEW_STATUS_LABELS,
  saveDecision,
  type SavedDecision,
} from '../../api/review';
import type { DecisionEntry, DecisionKind, ReviewStatus } from '../../api/types';
import shared from '../shared.module.css';
import styles from './Investigation.module.css';

const DECISIONS: { kind: DecisionKind; icon: LucideIcon; className: string }[] = [
  { kind: 'confirmed_fraud', icon: ShieldAlert, className: 'verdict_fraud' },
  { kind: 'false_positive', icon: ShieldCheck, className: 'verdict_legitimate' },
  { kind: 'needs_info', icon: CircleHelp, className: 'verdict_needs_info' },
];

const MAX_NOTES = 2000;

const decidedAtFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface DecisionPanelProps {
  transactionId: string;
  reviewStatus: ReviewStatus;
  /** Newest first. */
  decisions: readonly DecisionEntry[];
  onSaved: (saved: SavedDecision) => void;
}

/**
 * Records analyst decisions on a stored transaction. Decisions are only ever added: a
 * change of mind is a new decision, and every earlier one stays in the history below.
 */
export default function DecisionPanel({
  transactionId,
  reviewStatus,
  decisions,
  onSaved,
}: DecisionPanelProps) {
  const { expire } = useAuth();
  const notesId = useId();
  const [decision, setDecision] = useState<DecisionKind | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const latest = decisions[0];

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!decision) {
      setMessage({ text: 'Choose a decision before saving.', error: true });
      return;
    }
    if (!notes.trim()) {
      setMessage({ text: 'Add a note explaining the decision.', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveDecision(transactionId, decision, notes);
      onSaved(saved);
      setDecision(null);
      setNotes('');
      setMessage({ text: 'Decision saved.', error: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expire();
      setMessage({
        text: error instanceof Error ? error.message : 'The decision could not be saved.',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={shared.card} aria-labelledby="review-heading">
      <h2 id="review-heading" className={shared.cardTitle}>
        <Gavel size={17} aria-hidden="true" />
        Analyst decision
      </h2>
      <p className={`${shared.cardDescription} ${latest ? styles.savedLine : ''}`}>
        {REVIEW_STATUS_LABELS[reviewStatus]}
        {latest
          ? ` · ${DECISION_LABELS[latest.decision]} by ${latest.analyst.name}`
          : ' · no decision yet'}
      </p>

      <form className={styles.reviewForm} onSubmit={onSubmit} noValidate>
        <fieldset className={`${styles.verdicts} ${styles.verdicts_three}`}>
          <legend>{latest ? 'New decision' : 'Decision'}</legend>
          {DECISIONS.map(({ kind, icon: Icon, className }) => (
            <label key={kind} className={`${styles.verdict} ${styles[className]}`}>
              <input
                type="radio"
                name="decision"
                value={kind}
                checked={decision === kind}
                onChange={() => setDecision(kind)}
              />
              <Icon size={18} aria-hidden="true" />
              {DECISION_LABELS[kind]}
            </label>
          ))}
        </fieldset>
        <div className={styles.noteField}>
          <label htmlFor={notesId}>Note (required)</label>
          <textarea
            id={notesId}
            rows={3}
            maxLength={MAX_NOTES}
            required
            placeholder="What did you check, and what did you find?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={shared.buttonPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save decision'}
          </button>
          <span role="status" className={message?.error ? styles.messageError : styles.message}>
            {message?.text}
          </span>
        </div>
      </form>

      <h3 className={styles.historyHeading}>History</h3>
      {decisions.length === 0 ? (
        <p className={shared.muted}>No decisions yet.</p>
      ) : (
        <ol className={styles.history} aria-label="Decision history, newest first">
          {decisions.map((d) => (
            <li key={d.id} className={styles.historyItem}>
              <div className={styles.historyTop}>
                <strong>{DECISION_LABELS[d.decision]}</strong>
                <span className={styles.historyMeta}>
                  {d.analyst.name} ·{' '}
                  <time dateTime={d.decidedAt}>
                    {decidedAtFormat.format(new Date(d.decidedAt))}
                  </time>
                </span>
              </div>
              <p className={styles.historyNotes}>{d.notes}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
