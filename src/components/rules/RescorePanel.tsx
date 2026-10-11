import { ArrowRight, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { useQueueCount } from '../../api/queueCount';
import { previewRescore, runRescore } from '../../api/rules';
import type { RescoreSummary } from '../../api/types';
import { formatNumber } from '../../utils/format';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import styles from './Rules.module.css';

type State =
  | { step: 'idle' }
  | { step: 'busy'; label: string }
  | { step: 'preview'; summary: RescoreSummary }
  | { step: 'done'; summary: RescoreSummary }
  | { step: 'error'; message: string };

const plural = (count: number, word: string) =>
  `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/**
 * Re-scores stored transactions with the saved rules: preview first, then apply. Analyst
 * decisions and review statuses are kept; only scores, statuses and reasons change.
 */
export default function RescorePanel({ blockedBy }: { blockedBy: string | null }) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const refreshQueueCount = useQueueCount((s) => s.refresh);

  const run = async (label: string, action: () => Promise<{ summary: RescoreSummary }>) => {
    setState({ step: 'busy', label });
    try {
      return (await action()).summary;
    } catch (error) {
      setState({
        step: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
      return null;
    }
  };

  const preview = async () => {
    const summary = await run('Working out what would change…', previewRescore);
    if (summary) setState({ step: 'preview', summary });
  };
  const apply = async () => {
    const summary = await run('Re-scoring…', runRescore);
    if (summary) {
      setState({ step: 'done', summary });
      refreshQueueCount();
    }
  };

  return (
    <section className={shared.card} aria-labelledby="rescore-heading">
      <h2 id="rescore-heading" className={shared.cardTitle}>
        <RefreshCcw size={17} aria-hidden="true" />
        Re-score stored transactions
      </h2>
      <p className={shared.cardDescription}>
        Stored transactions keep the score they were given. Re-scoring applies the saved rules to
        all of them. Analyst decisions and review statuses are kept.
      </p>

      <div role="status" aria-live="polite">
        {state.step === 'busy' && <p className={styles.notice}>{state.label}</p>}
        {state.step === 'error' && <p className={styles.noticeError}>{state.message}</p>}
        {state.step === 'preview' && <Summary summary={state.summary} applied={false} />}
        {state.step === 'done' && <Summary summary={state.summary} applied />}
      </div>

      <div className={styles.rescoreActions}>
        {state.step === 'preview' && state.summary.changed > 0 ? (
          <>
            <button type="button" className={shared.buttonPrimary} onClick={() => void apply()}>
              Re-score {plural(state.summary.changed, 'transaction')}
            </button>
            <button
              type="button"
              className={shared.buttonGhost}
              onClick={() => setState({ step: 'idle' })}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className={shared.button}
            disabled={state.step === 'busy' || blockedBy !== null}
            onClick={() => void preview()}
          >
            Preview re-score
          </button>
        )}
        {blockedBy && <span className={styles.notice}>{blockedBy}</span>}
      </div>
    </section>
  );
}

function Summary({ summary, applied }: { summary: RescoreSummary; applied: boolean }) {
  if (summary.changed === 0) {
    return (
      <p className={styles.notice}>
        All {plural(summary.total, 'transaction')} already match the saved rules. Nothing to change.
      </p>
    );
  }
  return (
    <>
      <p className={styles.notice}>
        <strong>
          {applied ? 'Re-scored' : 'Would change'} {formatNumber(summary.changed)} of{' '}
          {plural(summary.total, 'transaction')}.
        </strong>{' '}
        Flagged {formatNumber(summary.flaggedBefore)} → {formatNumber(summary.flaggedAfter)} (
        {formatNumber(summary.newlyFlagged)} newly flagged, {formatNumber(summary.noLongerFlagged)}{' '}
        no longer flagged).
      </p>
      {summary.moves.length > 0 && (
        <ul className={styles.moves} aria-label="Risk level changes">
          {summary.moves.map((move) => (
            <li key={`${move.from}-${move.to}`}>
              {formatNumber(move.count)} <RiskBadge level={move.from} />
              <ArrowRight size={13} aria-label="to" />
              <RiskBadge level={move.to} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
