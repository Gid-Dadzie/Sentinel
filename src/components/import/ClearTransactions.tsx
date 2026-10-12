import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { clearTransactions } from '../../api/imports';
import { useQueueCount } from '../../api/queueCount';
import type { TransactionPage } from '../../api/types';
import { useApiData } from '../../api/useApiData';
import { formatNumber } from '../../utils/format';
import shared from '../shared.module.css';
import styles from './Import.module.css';

const plural = (count: number, word: string) =>
  `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/**
 * Deletes every stored transaction so a fresh file can be imported. Asks for confirmation
 * first; users, rules and the audit log are kept, and the clearing is audited.
 */
export default function ClearTransactions() {
  const stored = useApiData<TransactionPage>('/api/transactions?pageSize=1');
  const refreshQueueCount = useQueueCount((s) => s.refresh);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const total = stored.data?.total ?? 0;

  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { deleted } = await clearTransactions();
      setMessage({
        text: `Deleted ${plural(deleted.transactions, 'transaction')} and ${plural(deleted.decisions, 'decision')}. You can import a new file now.`,
        error: false,
      });
      setConfirming(false);
      stored.reload();
      refreshQueueCount();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'The transactions could not be deleted.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${shared.card} ${styles.clearCard}`} aria-labelledby="clear-heading">
      <h2 id="clear-heading" className={shared.cardTitle}>
        <Trash2 size={17} aria-hidden="true" />
        Start over
      </h2>
      <p className={shared.cardDescription}>
        {stored.data
          ? total === 0
            ? 'No transactions are stored.'
            : `${plural(total, 'transaction')} stored. Delete them all to import a different file from scratch. Users, rules and the audit log are kept.`
          : 'Checking what is stored…'}
      </p>

      {confirming ? (
        <div className={styles.clearConfirm} role="alertdialog" aria-labelledby="clear-warning">
          <p id="clear-warning">
            <strong>
              This permanently deletes all {plural(total, 'transaction')} and every analyst decision
              on them.
            </strong>{' '}
            It cannot be undone. The audit log will record that you did it.
          </p>
          <span className={styles.clearActions}>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={busy}
              onClick={() => void clear()}
            >
              {busy ? 'Deleting…' : `Yes, delete ${plural(total, 'transaction')}`}
            </button>
            <button
              type="button"
              className={shared.button}
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </span>
        </div>
      ) : (
        total > 0 && (
          <div className={styles.clearActions}>
            <button
              type="button"
              className={shared.button}
              onClick={() => {
                setMessage(null);
                setConfirming(true);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete all transactions…
            </button>
          </div>
        )
      )}

      {message && (
        <p role="status" className={message.error ? styles.error : styles.clearMessage}>
          {message.text}
        </p>
      )}
    </section>
  );
}
