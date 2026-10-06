import { Link } from 'react-router-dom';
import { DEFAULT_RULES } from '../../engine';
import { useFraudStore } from '../../state/useFraudStore';
import type { RuleId, ScoredTransaction } from '../../types';
import type { CustomerProfile, UsageCount } from '../../utils/customer';
import { capitalize, formatDate, formatDateTime, formatMoney } from '../../utils/format';
import { VERDICT_SHORT_LABELS } from '../../utils/investigation';
import RiskBadge from '../RiskBadge';
import shared from '../shared.module.css';
import styles from './Customer.module.css';

/** Rule names are fixed (only points and on/off are editable), so the defaults are the source. */
const RULE_NAMES = Object.fromEntries(DEFAULT_RULES.map((r) => [r.id, r.name])) as Record<
  RuleId,
  string
>;

/** Flagged transactions, riskiest first, with the rules that fired and any analyst verdict. */
export function FlaggedTransactions({ flagged }: { flagged: readonly ScoredTransaction[] }) {
  const reviews = useFraudStore((state) => state.reviews);
  const ordered = [...flagged].sort(
    (a, b) => b.riskScore - a.riskScore || b.timestamp.localeCompare(a.timestamp),
  );

  return (
    <section className={shared.card} aria-labelledby="flagged-heading">
      <h2 id="flagged-heading" className={shared.cardTitle}>
        Flagged transactions
      </h2>
      <p className={shared.cardDescription}>
        Scored medium risk or above with the current rules, riskiest first.
      </p>
      {ordered.length === 0 ? (
        <p className={styles.none}>Nothing flagged for this customer.</p>
      ) : (
        <ul className={styles.flaggedList}>
          {ordered.map((tx) => {
            const review = reviews[tx.id];
            return (
              <li key={tx.id} className={styles.flaggedItem}>
                <div className={styles.flaggedTop}>
                  <Link to={`/tx/${tx.id}`} className={styles.flaggedId}>
                    {tx.id}
                  </Link>
                  <RiskBadge level={tx.riskLevel} score={tx.riskScore} />
                </div>
                <p className={styles.flaggedMeta}>
                  {formatMoney(tx.amount, tx.currency)} at {tx.merchant}, {tx.location.city} ·{' '}
                  {formatDateTime(tx.timestamp)}
                </p>
                <p className={styles.flaggedRules}>
                  {tx.fraudReasons.map((r) => `${RULE_NAMES[r.ruleId]} +${r.points}`).join(' · ')}
                </p>
                {review && (
                  <p className={styles.flaggedReview}>{VERDICT_SHORT_LABELS[review.verdict]}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface UsageListProps {
  title: string;
  items: readonly UsageCount[];
  total: number;
  format?: (name: string) => string;
  showDates?: boolean;
}

function UsageList({ title, items, total, format = (n) => n, showDates = false }: UsageListProps) {
  return (
    <div className={styles.usage}>
      <h3 className={styles.usageTitle}>{title}</h3>
      <ul className={styles.usageList} aria-label={title}>
        {items.map((item) => (
          <li key={item.name}>
            <div className={styles.usageRow}>
              <span>{format(item.name)}</span>
              <span className={styles.usageCount}>
                {item.count}
                <span className="visually-hidden"> transactions</span>
              </span>
            </div>
            <div className={styles.usageBar} aria-hidden="true">
              <div style={{ width: `${(item.count / total) * 100}%` }} />
            </div>
            {showDates && (
              <p className={styles.usageDates}>
                {formatDate(item.firstSeen)} – {formatDate(item.lastSeen)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where, how and on what the customer normally transacts. */
export function BehaviourProfile({ profile }: { profile: CustomerProfile }) {
  const total = profile.transactions.length;
  return (
    <section className={shared.card} aria-labelledby="behaviour-heading">
      <h2 id="behaviour-heading" className={shared.cardTitle}>
        Usual behaviour
      </h2>
      <p className={shared.cardDescription}>Share of all {total} transactions.</p>
      <div className={styles.usageGrid}>
        <UsageList title="Countries" items={profile.countries} total={total} />
        <UsageList title="Cities" items={profile.cities} total={total} />
        <UsageList title="Devices" items={profile.devices} total={total} showDates />
        <UsageList
          title="Categories"
          items={profile.categories}
          total={total}
          format={capitalize}
        />
      </div>
    </section>
  );
}
