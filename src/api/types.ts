/** Shapes the API sends back. Kept in step with server/src/routes by the API tests. */

import type { ScoredTransaction } from '@sentinel/engine';
import type { DailyCount, DashboardSummary, RiskLevelCount } from '../utils/dashboard';

export type Role = 'analyst' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type ImportFieldKey =
  | 'id'
  | 'accountId'
  | 'customerName'
  | 'amount'
  | 'currency'
  | 'txnType'
  | 'timestamp'
  | 'merchant'
  | 'category'
  | 'city'
  | 'country'
  | 'deviceId'
  | 'senderMsisdn'
  | 'recipientMsisdn'
  | 'agentId';

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

export interface ImportPreview {
  fileName: string;
  format: 'csv' | 'xlsx';
  headers: string[];
  /** The first few rows, cell by cell (dates arrive as ISO strings). */
  sample: (string | number | boolean | null)[][];
  rowCount: number;
  fields: { key: ImportFieldKey; label: string; required: boolean }[];
  suggestedMapping: ColumnMapping;
}

export interface RejectedRow {
  row: number;
  id: string | null;
  problems: string[];
}

export interface ImportReport {
  fileName: string;
  totalRows: number;
  imported: number;
  flagged: number;
  rejected: RejectedRow[];
  duplicates: RejectedRow[];
}

// ---- Stored transactions and reviews ----

export type ReviewStatus = 'new' | 'under_review' | 'resolved';
export type DecisionKind = 'confirmed_fraud' | 'false_positive' | 'needs_info';
export type TxnType = 'cash_in' | 'cash_out' | 'transfer' | 'airtime' | 'payment';

/** A stored transaction: the engine's shape plus what only stored data has. */
export interface ApiTransaction extends ScoredTransaction {
  txnType: TxnType;
  /** Masked, e.g. "024****601". */
  senderMsisdn: string;
  recipientMsisdn: string | null;
  agentId: string | null;
  reviewStatus: ReviewStatus;
  latestDecision: { decision: DecisionKind; decidedAt: string } | null;
}

export interface TransactionPage {
  items: ApiTransaction[];
  total: number;
  page: number;
  pageCount: number;
}

export interface DecisionEntry {
  id: string;
  decision: DecisionKind;
  notes: string;
  decidedAt: string; // ISO timestamp
  analyst: { id: string; name: string };
}

export interface TransactionDetail {
  transaction: ApiTransaction;
  /** Newest first. Decisions are never edited or removed. */
  decisions: DecisionEntry[];
}

export interface DashboardData {
  summary: DashboardSummary;
  byLevel: RiskLevelCount[];
  daily: DailyCount[];
  needsReview: number;
  /** The riskiest few that still need review. */
  queue: ApiTransaction[];
  countries: string[];
}

export interface CustomerData {
  accountId: string;
  /** Oldest first. */
  transactions: ApiTransaction[];
}
