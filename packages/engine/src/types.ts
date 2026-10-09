/** Shared domain types. Defined once here and imported everywhere else. */

export const STATUSES = ['approved', 'declined', 'pending'] as const;
export type Status = (typeof STATUSES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RULE_IDS = ['amount', 'time', 'country', 'device', 'rapid', 'travel'] as const;
export type RuleId = (typeof RULE_IDS)[number];

export interface Location {
  city: string;
  country: string;
}

/** One triggered rule and the points it added, shown as "+25 Amount is 18x the average". */
export interface FraudReason {
  ruleId: RuleId;
  points: number;
  text: string;
}

export interface Transaction {
  id: string; // "TX-10482"
  accountId: string; // "ACC-2001"
  customerName: string;
  amount: number;
  currency: string; // "GHS"
  merchant: string;
  category: string;
  location: Location;
  timestamp: string; // local ISO without zone, "2026-10-05T02:34:00"
  deviceId: string;
  status: Status;
  riskScore?: number;
  riskLevel?: RiskLevel;
  fraudReasons?: FraudReason[];
}

/** A transaction after the engine has run: the risk fields are always present. */
export type ScoredTransaction = Transaction &
  Required<Pick<Transaction, 'riskScore' | 'riskLevel' | 'fraudReasons'>>;

export interface RuleConfig {
  id: RuleId;
  name: string;
  condition: string;
  points: number;
  enabled: boolean;
}

export interface FraudResult {
  score: number;
  reasons: FraudReason[];
}
