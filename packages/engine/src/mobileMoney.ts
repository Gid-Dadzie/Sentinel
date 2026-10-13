/**
 * Mobile money rules. Each is a separate pure check, tested on its own; points and the
 * on/off switch come from the rule settings like every other rule. They need the
 * mobile money fields (type, recipient, agent) and never fire on transactions without them.
 */
import { formatDuration, formatMoney, formatNumber } from './format';
import type { RuleCheck, RuleContext } from './ruleContext';
import { THRESHOLDS } from './rules';
import { HOUR_MS, MINUTE_MS, parseLocalTimestamp } from './time';
import type { Transaction } from './types';

/** Earlier transactions no more than `windowMs` before now. */
function withinWindow({ history, nowMs }: RuleContext, windowMs: number): Transaction[] {
  return history.filter((tx) => {
    const age = nowMs - parseLocalTimestamp(tx.timestamp).ms;
    return age >= 0 && age <= windowMs;
  });
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** Money cashed in and most of it taken out again soon after: a mule or a scam payout. */
export const rapidCashOut: RuleCheck = (ctx) => {
  const { transaction, nowMs } = ctx;
  if (transaction.txnType !== 'cash_out') return null;
  const deposits = withinWindow(ctx, THRESHOLDS.cashOutWindowMinutes * MINUTE_MS).filter(
    (tx) => tx.txnType === 'cash_in',
  );
  const first = deposits[0];
  if (!first) return null;
  const deposited = deposits.reduce((sum, tx) => sum + tx.amount, 0);
  const share = transaction.amount / deposited;
  if (share < THRESHOLDS.cashOutShareOfDeposits) return null;
  const minutes = (nowMs - parseLocalTimestamp(first.timestamp).ms) / MINUTE_MS;
  return `Cash-out of ${formatMoney(transaction.amount, transaction.currency)} is ${percent(share)} of the ${formatMoney(deposited, transaction.currency)} cashed in ${formatDuration(minutes)} earlier.`;
};

/** Money sent to many different people in a short time: a wallet being emptied. */
export const manyRecipients: RuleCheck = (ctx) => {
  const { transaction } = ctx;
  if (transaction.txnType !== 'transfer' || !transaction.recipient) return null;
  const recipients = new Set(
    withinWindow(ctx, THRESHOLDS.recipientsWindowMinutes * MINUTE_MS)
      .filter((tx) => tx.txnType === 'transfer' && tx.recipient)
      .map((tx) => tx.recipient),
  );
  recipients.add(transaction.recipient);
  if (recipients.size < THRESHOLDS.recipientsMinCount) return null;
  return `Transfers to ${recipients.size} different recipients within ${THRESHOLDS.recipientsWindowMinutes} minutes, including this one.`;
};

/** A large cash-out at an agent the account has never used: often someone else's phone or PIN. */
export const newAgentLargeCashOut: RuleCheck = ({ transaction, history }) => {
  if (transaction.txnType !== 'cash_out' || !transaction.agentId) return null;
  if (history.length < THRESHOLDS.agentMinHistory) return null;
  if (history.some((tx) => tx.agentId === transaction.agentId)) return null;
  const average = history.reduce((sum, tx) => sum + tx.amount, 0) / history.length;
  if (!(transaction.amount > average * THRESHOLDS.agentAmountMultiplier)) return null;
  const ratio = (transaction.amount / average).toFixed(1);
  return `Cash-out of ${formatMoney(transaction.amount, transaction.currency)} at agent ${transaction.agentId}, never used by this account, is ${ratio}× its average of ${formatMoney(Math.round(average), transaction.currency)}.`;
};

/** Many airtime top-ups in minutes: stolen money turned into something easy to resell. */
export const airtimeBurst: RuleCheck = (ctx) => {
  if (ctx.transaction.txnType !== 'airtime') return null;
  const count =
    withinWindow(ctx, THRESHOLDS.airtimeWindowMinutes * MINUTE_MS).filter(
      (tx) => tx.txnType === 'airtime',
    ).length + 1;
  if (count < THRESHOLDS.airtimeMinCount) return null;
  return `${count} airtime purchases within ${THRESHOLDS.airtimeWindowMinutes} minutes, including this one.`;
};

/** Several amounts kept just under a reporting limit: splitting to avoid checks. */
export const structuring: RuleCheck = (ctx) => {
  if (!ctx.transaction.txnType) return null; // mobile money data only, like the other rules here
  const limit = THRESHOLDS.structuringLimit;
  const isNearLimit = (amount: number) =>
    amount >= limit * THRESHOLDS.structuringNearShare && amount < limit;
  if (!isNearLimit(ctx.transaction.amount)) return null;
  const count =
    withinWindow(ctx, THRESHOLDS.structuringWindowHours * HOUR_MS).filter((tx) =>
      isNearLimit(tx.amount),
    ).length + 1;
  if (count < THRESHOLDS.structuringMinCount) return null;
  return `${count} transactions within ${THRESHOLDS.structuringWindowHours} hours, each just under the ${formatNumber(limit)} reporting limit, including this one.`;
};
