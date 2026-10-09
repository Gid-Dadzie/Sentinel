import { compareChronological, isFlagged } from '../engine';
import type { ScoredTransaction } from '../types';

/** How many of the latest transactions make up the customer's current risk. */
export const CURRENT_RISK_WINDOW = 5;

export interface UsageCount {
  name: string;
  count: number;
  firstSeen: string; // timestamp
  lastSeen: string; // timestamp
}

export interface CustomerProfile {
  accountId: string;
  name: string;
  /** Oldest first. */
  transactions: ScoredTransaction[];
  totalAmount: number;
  averageAmount: number;
  largestAmount: number;
  /** Rounded average score of the last 5 transactions; its level is the customer's current risk. */
  currentScore: number;
  flagged: ScoredTransaction[];
  maxScore: number;
  firstSeen: string;
  lastSeen: string;
  countries: UsageCount[];
  cities: UsageCount[];
  devices: UsageCount[];
  categories: UsageCount[];
}

/** Counts each value with first/last use; most used first, ties by first use. */
function countUsage(
  transactions: readonly ScoredTransaction[],
  pick: (tx: ScoredTransaction) => string,
): UsageCount[] {
  const usage = new Map<string, UsageCount>();
  for (const tx of transactions) {
    const name = pick(tx);
    const entry = usage.get(name);
    if (entry) {
      entry.count += 1;
      entry.lastSeen = tx.timestamp;
    } else {
      usage.set(name, { name, count: 1, firstSeen: tx.timestamp, lastSeen: tx.timestamp });
    }
  }
  return [...usage.values()].sort(
    (a, b) => b.count - a.count || a.firstSeen.localeCompare(b.firstSeen),
  );
}

/** Everything the profile page shows for one account, or null if it has no transactions. */
export function getCustomerProfile(
  transactions: readonly ScoredTransaction[],
  accountId: string,
): CustomerProfile | null {
  const own = transactions.filter((tx) => tx.accountId === accountId).sort(compareChronological);
  const first = own[0];
  const last = own[own.length - 1];
  if (!first || !last) return null;

  const totalAmount = own.reduce((sum, tx) => sum + tx.amount, 0);
  const recent = own.slice(-CURRENT_RISK_WINDOW);
  return {
    accountId,
    name: last.customerName,
    transactions: own,
    totalAmount,
    averageAmount: totalAmount / own.length,
    largestAmount: Math.max(...own.map((tx) => tx.amount)),
    currentScore: Math.round(recent.reduce((sum, tx) => sum + tx.riskScore, 0) / recent.length),
    flagged: own.filter((tx) => isFlagged(tx.riskScore)),
    maxScore: Math.max(...own.map((tx) => tx.riskScore)),
    firstSeen: first.timestamp,
    lastSeen: last.timestamp,
    countries: countUsage(own, (tx) => tx.location.country),
    cities: countUsage(own, (tx) => tx.location.city),
    devices: countUsage(own, (tx) => tx.deviceId),
    categories: countUsage(own, (tx) => tx.category),
  };
}
