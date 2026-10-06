import { useMemo } from 'react';
import RuleEditor from '../components/rules/RuleEditor';
import styles from '../components/rules/Rules.module.css';
import RiskBadge from '../components/RiskBadge';
import shared from '../components/shared.module.css';
import { createDefaultRules, scoreAll } from '../engine';
import { RAW_TRANSACTIONS, useFraudStore } from '../state/useFraudStore';
import { RISK_LEVELS } from '../types';
import { formatNumber } from '../utils/format';
import { compareToDefaults, formatDelta, isRuleModified, triggerCounts } from '../utils/rules';

const BANDS: Record<(typeof RISK_LEVELS)[number], { range: string; decision: string }> = {
  low: { range: '0–25', decision: 'Approved' },
  medium: { range: '26–50', decision: 'Approved, flagged for attention' },
  high: { range: '51–75', decision: 'Pending manual review' },
  critical: { range: '76–100', decision: 'Declined' },
};

export default function Rules() {
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
      <div className={styles.header}>
        <div className={shared.intro}>
          <h1>Rules</h1>
          <p>
            Every change re-scores all {formatNumber(transactions.length)} transactions straight
            away and is saved in this browser.
          </p>
        </div>
        <button
          type="button"
          className={styles.reset}
          disabled={changed === 0}
          onClick={resetRules}
        >
          Reset to defaults
        </button>
      </div>

      <section className={shared.card} aria-labelledby="impact-heading">
        <h2 id="impact-heading" className={shared.cardTitle}>
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

      <section className={shared.card} aria-labelledby="bands-heading">
        <h2 id="bands-heading" className={shared.cardTitle}>
          How scores become decisions
        </h2>
        <p className={shared.cardDescription}>
          Points from every triggered rule are added up and capped at 100.
        </p>
        <div className={shared.tableScroll}>
          <table className={shared.table} aria-labelledby="bands-heading">
            <thead>
              <tr>
                <th scope="col">Risk level</th>
                <th scope="col">Score</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {RISK_LEVELS.map((level) => (
                <tr key={level}>
                  <th scope="row">
                    <RiskBadge level={level} />
                  </th>
                  <td className={shared.nowrap}>{BANDS[level].range}</td>
                  <td>{BANDS[level].decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
