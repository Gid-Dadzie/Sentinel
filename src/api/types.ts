/** Shapes the API sends back. Kept in step with server/src/routes by the API tests. */

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
