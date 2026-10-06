import { useState, type FormEvent } from 'react';
import { useFraudStore } from '../../state/useFraudStore';
import type { Verdict } from '../../types';
import { VERDICT_LABELS } from '../../utils/investigation';
import shared from '../shared.module.css';
import styles from './Investigation.module.css';

const reviewedAtFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * The analyst's verdict. Stored separately from the score, so it survives rule
 * changes. The parent keys this by transaction ID to reset the draft on navigation.
 */
export default function ReviewPanel({ transactionId }: { transactionId: string }) {
  const saved = useFraudStore((state) => state.reviews[transactionId]);
  const saveReview = useFraudStore((state) => state.saveReview);
  const clearReview = useFraudStore((state) => state.clearReview);

  const [verdict, setVerdict] = useState<Verdict | null>(saved?.verdict ?? null);
  const [note, setNote] = useState(saved?.note ?? '');
  const [message, setMessage] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!verdict) {
      setMessage('Choose a verdict before saving.');
      return;
    }
    saveReview(transactionId, verdict, note);
    setMessage('Review saved.');
  };

  const onClear = () => {
    clearReview(transactionId);
    setVerdict(null);
    setNote('');
    setMessage('Review cleared.');
  };

  return (
    <section className={shared.card} aria-labelledby="review-heading">
      <h2 id="review-heading" className={shared.cardTitle}>
        Analyst review
      </h2>
      <p className={shared.cardDescription}>
        {saved
          ? `${VERDICT_LABELS[saved.verdict]} · saved ${reviewedAtFormat.format(new Date(saved.reviewedAt))}`
          : 'Not reviewed yet.'}
      </p>
      <form className={styles.reviewForm} onSubmit={onSubmit}>
        <fieldset className={styles.verdicts}>
          <legend>Verdict</legend>
          {(Object.keys(VERDICT_LABELS) as Verdict[]).map((option) => (
            <label key={option} className={styles.radio}>
              <input
                type="radio"
                name="verdict"
                value={option}
                checked={verdict === option}
                onChange={() => setVerdict(option)}
              />
              {VERDICT_LABELS[option]}
            </label>
          ))}
        </fieldset>
        <label className={styles.noteField}>
          <span>Note (optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Save review
          </button>
          {saved && (
            <button type="button" className={styles.secondary} onClick={onClear}>
              Clear review
            </button>
          )}
          <span role="status" className={styles.message}>
            {message}
          </span>
        </div>
      </form>
    </section>
  );
}
