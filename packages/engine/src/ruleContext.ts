import type { Transaction } from './types';

/** What every rule check sees. */
export interface RuleContext {
  transaction: Transaction;
  /** Same account, earlier timestamps only, sorted ascending. */
  history: readonly Transaction[];
  /** The transaction's own time, which is "now" for every check. */
  nowMs: number;
  hour: number;
  minute: number;
}

/** Returns a plain-language reason when the rule triggers, otherwise null. */
export type RuleCheck = (ctx: RuleContext) => string | null;
