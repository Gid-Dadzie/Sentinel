import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateTransactions } from '../data/generateData';
import { clampPoints, createDefaultRules, scoreAll } from '../engine';
import type { Review, RuleConfig, RuleId, ScoredTransaction, Verdict } from '../types';
import { RULES_STORAGE_KEY, reviewsFromPersisted, rulesFromPersisted } from './rulesStorage';

/** Generated once; scores are always derived from these plus the current rules. */
export const RAW_TRANSACTIONS = generateTransactions();

export type RulePatch = Partial<Pick<RuleConfig, 'points' | 'enabled'>>;

interface FraudState {
  rules: RuleConfig[];
  /** Chronological, scored by the engine with the current rules. */
  transactions: ScoredTransaction[];
  /** Analyst decisions keyed by transaction ID. Independent of rules and scores. */
  reviews: Record<string, Review>;
  updateRule: (id: RuleId, patch: RulePatch) => void;
  resetRules: () => void;
  saveReview: (transactionId: string, verdict: Verdict, note: string) => void;
  clearReview: (transactionId: string) => void;
}

/** Every rules change goes through here so transactions are always re-scored. */
function withRules(rules: RuleConfig[]): Pick<FraudState, 'rules' | 'transactions'> {
  return { rules, transactions: scoreAll(RAW_TRANSACTIONS, rules) };
}

export const useFraudStore = create<FraudState>()(
  persist(
    (set) => ({
      ...withRules(createDefaultRules()),
      reviews: {},
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
      saveReview: (transactionId, verdict, note) =>
        set((state) => ({
          reviews: {
            ...state.reviews,
            [transactionId]: { verdict, note: note.trim(), reviewedAt: new Date().toISOString() },
          },
        })),
      clearReview: (transactionId) =>
        set((state) => {
          const { [transactionId]: _removed, ...rest } = state.reviews; // eslint-disable-line @typescript-eslint/no-unused-vars
          return { reviews: rest };
        }),
    }),
    {
      name: RULES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rules: state.rules, reviews: state.reviews }),
      merge: (persisted, current) => ({
        ...current,
        ...withRules(rulesFromPersisted(persisted)),
        reviews: reviewsFromPersisted(persisted),
      }),
    },
  ),
);
