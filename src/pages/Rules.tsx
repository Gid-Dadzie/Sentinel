import { Activity, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { API_MODE } from '../api/client';
import RuleEditor from '../components/rules/RuleEditor';
import ScoreBands from '../components/rules/ScoreBands';
import styles from '../components/rules/Rules.module.css';
import PageHeader from '../components/PageHeader';
import shared from '../components/shared.module.css';
import { createDefaultRules, scoreAll } from '@sentinel/engine';
import { RAW_TRANSACTIONS, useFraudStore } from '../state/useFraudStore';
import { formatNumber } from '../utils/format';
import StoredRules from './stored/StoredRules';
import { compareToDefaults, formatDelta, isRuleModified, triggerCounts } from '../utils/rules';

export default function Rules() {
  return API_MODE ? <StoredRules /> : <DemoRules />;
}

/** Rules for the generated data, editable and saved in this browser. */
function DemoRules() {
  const rules = useFraudStore((state) => state.rules);
  const transactions = useFraudStore((state) => state.transactions);
  const resetRules = useFraudStore((state) => state.resetRules);

  // Both depend only on the fixed generated data, so compute them once.
  const fires = useMemo(() => triggerCounts(RAW_TRANSACTIONS), []);
  const baseline = useMemo(() => scoreAll(RAW_TRANSACTIONS, createDefaultRules()), []);
  const impact = useMemo(() => compareToDefaults(transactions, baseline), [transactions, baseline]);
  const changed = rules.filter(isRuleModified).length;

  return (
    <div className={shared.page}>
      <PageHeader
        title="Rules"
        meta={`Every change re-scores all ${formatNumber(transactions.length)} transactions straight away and is saved in this browser.`}
        actions={
          <button
            type="button"
            className={shared.button}
            disabled={changed === 0}
            onClick={resetRules}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Reset to defaults
          </button>
        }
      />

      <section className={shared.card} aria-labelledby="impact-heading">
        <h2 id="impact-heading" className={shared.cardTitle}>
          <Activity size={17} aria-hidden="true" />
          Impact of your changes
        </h2>
        <p className={shared.cardDescription}>
          {changed === 0
            ? 'All rules are at their defaults.'
            : `${changed} rule${changed === 1 ? '' : 's'} changed. Compared with the default rules:`}
        </p>
        <dl className={styles.impact}>
          {impact.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd className={styles.impactValue}>{formatNumber(row.current)}</dd>
              <dd className={styles.impactDelta}>
                {formatDelta(row.current, row.baseline)}
                {row.current !== row.baseline && ` (default ${formatNumber(row.baseline)})`}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className={styles.rules}>
        {rules.map((rule) => (
          <RuleEditor key={rule.id} rule={rule} fires={fires[rule.id]} />
        ))}
      </div>

      <ScoreBands />
    </div>
  );
}
