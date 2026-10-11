import { RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { clampPoints } from '@sentinel/engine';
import { useOptionalUser } from '../../api/auth';
import { saveRule } from '../../api/rules';
import type { RuleFeedback } from '../../api/types';
import { useApiData } from '../../api/useApiData';
import { PageLoading, PageProblem } from '../../components/LoadState';
import PageHeader from '../../components/PageHeader';
import RescorePanel from '../../components/rules/RescorePanel';
import RuleEditor from '../../components/rules/RuleEditor';
import styles from '../../components/rules/Rules.module.css';
import ScoreBands from '../../components/rules/ScoreBands';
import shared from '../../components/shared.module.css';
import type { RulePatch } from '../../state/useFraudStore';
import type { RuleConfig } from '../../types';
import { formatNumber } from '../../utils/format';

const plural = (count: number, word: string) =>
  `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/** "Fired on 12 stored transactions · 3 confirmed fraud · 5 false positives". */
function usageText(feedback: RuleFeedback | undefined): string {
  if (!feedback) return '';
  const parts = [`Fired on ${plural(feedback.fired, 'stored transaction')}`];
  if (feedback.confirmedFraud + feedback.falsePositive > 0) {
    parts.push(`${formatNumber(feedback.confirmedFraud)} confirmed fraud`);
    parts.push(plural(feedback.falsePositive, 'false positive'));
  }
  return parts.join(' · ');
}

const differs = (a: RuleConfig, b: RuleConfig | undefined) =>
  !b || a.points !== b.points || a.enabled !== b.enabled;

/**
 * The rules imports are scored with. Admins change them here (every change is audited)
 * and can then re-score stored transactions; analysts see them read-only.
 */
export default function StoredRules() {
  const isAdmin = useOptionalUser()?.role === 'admin';
  const rules = useApiData<{ rules: RuleConfig[] }>('/api/rules');
  const feedback = useApiData<{ feedback: RuleFeedback[] }>('/api/rules/feedback');
  const [draft, setDraft] = useState<RuleConfig[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (!rules.data) {
    return rules.error ? (
      <PageProblem title="Rules" error={rules.error} onRetry={rules.reload} />
    ) : (
      <PageLoading title="Rules" />
    );
  }

  const saved = rules.data.rules;
  const shown = draft ?? saved;
  const savedById = new Map(saved.map((rule) => [rule.id, rule]));
  const changed = shown.filter((rule) => differs(rule, savedById.get(rule.id)));
  const feedbackById = new Map(feedback.data?.feedback.map((f) => [f.ruleId, f]));

  const edit = (id: RuleConfig['id'], patch: RulePatch) => {
    setMessage(null);
    setDraft(
      shown.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              enabled: patch.enabled ?? rule.enabled,
              points: patch.points === undefined ? rule.points : clampPoints(patch.points),
            }
          : rule,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    let done = 0;
    try {
      for (const rule of changed) {
        const { rule: stored } = await saveRule(rule.id, {
          points: rule.points,
          enabled: rule.enabled,
        });
        rules.setData((current) => ({
          rules: current.rules.map((r) => (r.id === stored.id ? stored : r)),
        }));
        done += 1;
      }
      setDraft(null);
      setMessage({
        text: `Saved ${plural(done, 'rule change')}. New imports use them now; re-score below to update stored transactions.`,
        error: false,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Saving failed.';
      setMessage({
        text: done > 0 ? `Saved ${plural(done, 'rule')}, then: ${reason}` : reason,
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shared.page}>
      <PageHeader
        title="Rules"
        meta={
          isAdmin
            ? 'New imports are scored with these rules. Every change is recorded in the audit log.'
            : 'New imports are scored with these rules. Only admins can change them.'
        }
      />
      {message && (
        <p role="status" className={message.error ? styles.noticeError : styles.notice}>
          {message.text}
        </p>
      )}
      <div className={styles.rules}>
        {shown.map((rule) => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            readOnly={!isAdmin || saving}
            onChange={(patch) => edit(rule.id, patch)}
            usage={usageText(feedbackById.get(rule.id))}
          />
        ))}
      </div>

      {isAdmin && changed.length > 0 && (
        <div className={styles.saveBar} role="region" aria-label="Unsaved rule changes">
          <span>{plural(changed.length, 'rule')} changed, not saved yet.</span>
          <span className={styles.saveActions}>
            <button
              type="button"
              className={shared.buttonGhost}
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Discard
            </button>
            <button
              type="button"
              className={shared.buttonPrimary}
              disabled={saving}
              onClick={() => void save()}
            >
              <Save size={15} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </span>
        </div>
      )}

      {isAdmin && (
        <RescorePanel
          blockedBy={changed.length > 0 ? 'Save or discard your rule changes first.' : null}
        />
      )}
      <ScoreBands />
    </div>
  );
}
