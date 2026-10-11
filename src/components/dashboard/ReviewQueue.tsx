import { CheckCheck, ChevronRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ScoredTransaction } from '../../types';
import { formatDateTime, formatMoney } from '../../utils/format';
import { RULE_NAMES } from '../../utils/rules';
import RiskBadge from '../RiskBadge';
import type { ReviewLabels } from '../TransactionTable';
import ScoreChip from '../ScoreChip';
import shared from '../shared.module.css';
import styles from './Dashboard.module.css';

const VISIBLE = 6;

interface ReviewQueueProps {
  /** Riskiest first; only the first few are shown. */
  queue: readonly ScoredTransaction[];
  /** The queue's full size, when `queue` holds only the first few. */
  total?: number;
  description: string;
  /** Where "View all" goes: the table filtered to the queue. */
  viewAllHref: string;
  /** Progress so far, e.g. "Under review: needs info". */
  reviewLabels?: ReviewLabels;
}

/** The analyst's to-do list: flagged and not yet reviewed, riskiest first. */
export default function ReviewQueue({
  queue,
  total = queue.length,
  description,
  viewAllHref,
  reviewLabels = {},
}: ReviewQueueProps) {
  const visible = queue.slice(0, VISIBLE);

  return (
    <section className={`${shared.card} ${styles.queueCard}`} aria-labelledby="queue-heading">
      <div className={shared.cardHead}>
        <div>
          <h2 id="queue-heading" className={shared.cardTitle}>
            <Inbox size={17} aria-hidden="true" />
            Review queue
          </h2>
          <p className={shared.cardDescription}>{description}</p>
        </div>
        {total > visible.length && (
          <Link to={viewAllHref} className={shared.buttonGhost}>
            View all {total}
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <div className={shared.empty}>
          <CheckCheck size={28} aria-hidden="true" />
          <strong>All caught up</strong>
          <span>Every flagged transaction has a verdict.</span>
        </div>
      ) : (
        <ul className={styles.queue} aria-label="Transactions to review">
          {visible.map((tx) => (
            <li key={tx.id} className={styles.queueItem}>
              <ScoreChip score={tx.riskScore} level={tx.riskLevel} />
              <span className="visually-hidden">Score {tx.riskScore}.</span>
              <div className={styles.queueMain}>
                <div className={styles.queueTitle}>
                  <Link to={`/tx/${tx.id}`} className={`${styles.queueLink} mono`}>
                    {tx.id}
                  </Link>
                  <span className={styles.queueCustomer}>{tx.customerName}</span>
                  <RiskBadge level={tx.riskLevel} />
                  {reviewLabels[tx.id] && (
                    <span className={styles.queueProgress}>{reviewLabels[tx.id]}</span>
                  )}
                </div>
                <p className={styles.queueMeta}>
                  {tx.merchant} · {tx.location.city} · {formatDateTime(tx.timestamp)}
                </p>
                <ul className={styles.reasonChips} aria-label="Triggered rules">
                  {tx.fraudReasons.map((r) => (
                    <li key={r.ruleId}>
                      {RULE_NAMES[r.ruleId]} <span>+{r.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.queueAmount}>{formatMoney(tx.amount, tx.currency)}</div>
              <ChevronRight size={18} className={styles.queueChevron} aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
