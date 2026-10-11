import type { RuleConfig } from '../../types';
import { useApiData } from '../../api/useApiData';
import { PageLoading, PageProblem } from '../../components/LoadState';
import PageHeader from '../../components/PageHeader';
import { RULE_ICONS } from '../../components/ruleIcons';
import styles from '../../components/rules/Rules.module.css';
import ScoreBands from '../../components/rules/ScoreBands';
import shared from '../../components/shared.module.css';

/** The rules imports are scored with. Read-only until rule changes are audited. */
export default function StoredRules() {
  const { data, error, reload } = useApiData<{ rules: RuleConfig[] }>('/api/rules');

  if (!data) {
    return error ? (
      <PageProblem title="Rules" error={error} onRetry={reload} />
    ) : (
      <PageLoading title="Rules" />
    );
  }

  return (
    <div className={shared.page}>
      <PageHeader
        title="Rules"
        meta="New imports are scored with these rules. Stored transactions keep the score they were given."
      />
      <div className={styles.rules}>
        {data.rules.map((rule) => {
          const RuleIcon = RULE_ICONS[rule.id];
          return (
            <section
              key={rule.id}
              className={`${styles.rule} ${rule.enabled ? '' : styles.ruleOff}`}
              aria-labelledby={`rule-${rule.id}`}
            >
              <div className={styles.ruleHeader}>
                <span className={styles.ruleIcon} aria-hidden="true">
                  <RuleIcon size={18} />
                </span>
                <div className={styles.ruleTitle}>
                  <h2 id={`rule-${rule.id}`} className={styles.ruleName}>
                    {rule.name}
                  </h2>
                  <p className={styles.condition}>{rule.condition}.</p>
                </div>
              </div>
              <p className={styles.ruleFooter}>{rule.enabled ? `${rule.points} points` : 'Off'}</p>
            </section>
          );
        })}
      </div>
      <ScoreBands />
    </div>
  );
}
