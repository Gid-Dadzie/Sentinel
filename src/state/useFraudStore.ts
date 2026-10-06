import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateTransactions } from '../data/generateData';
import { clampPoints, createDefaultRules, scoreAll } from '../engine';
import type { RuleConfig, RuleId, ScoredTransaction } from '../types';
import { RULES_STORAGE_KEY, rulesFromPersisted } from './rulesStorage';

/** Generated once; scores are always derived from these plus the current rules. */
export const RAW_TRANSACTIONS = generateTransactions();

export type RulePatch = Partial<Pick<RuleConfig, 'points' | 'enabled'>>;

interface FraudState {
  rules: RuleConfig[];
  /** Chronological, scored by the engine with the current rules. */
  transactions: ScoredTransaction[];
  updateRule: (id: RuleId, patch: RulePatch) => void;
  resetRules: () => void;
}

/** Every rules change goes through here so transactions are always re-scored. */
function withRules(rules: RuleConfig[]): Pick<FraudState, 'rules' | 'transactions'> {
  return { rules, transactions: scoreAll(RAW_TRANSACTIONS, rules) };
}

export const useFraudStore = create<FraudState>()(
  persist(
    (set) => ({
      ...withRules(createDefaultRules()),
      updateRule: (id, patch) =>
        set((state) =>
          withRules(
            state.rules.map((rule) =>
              rule.id === id
                ? {
                    ...rule,
                    enabled: patch.enabled ?? rule.enabled,
                    points: patch.points === undefined ? rule.points : clampPoints(patch.points),
                  }
                : rule,
            ),
          ),
        ),
      resetRules: () => set(withRules(createDefaultRules())),
    }),
    {
      name: RULES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rules: state.rules }),
      merge: (persisted, current) => ({ ...current, ...withRules(rulesFromPersisted(persisted)) }),
    },
  ),
);
