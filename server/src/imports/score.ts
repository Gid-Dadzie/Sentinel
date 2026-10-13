import {
  RULE_IDS,
  calculateFraudRisk,
  compareChronological,
  getRiskLevel,
  getStatus,
  type FraudReason,
  type RiskLevel,
  type RuleConfig,
  type RuleId,
  type Status,
  type Transaction,
} from '@sentinel/engine';
import type { ImportRow } from './validate';

export interface ScoredImportRow extends ImportRow {
  riskScore: number;
  riskLevel: RiskLevel;
  status: Status;
  reasons: FraudReason[];
}

/** What the engine needs from a stored transaction. */
export type StoredHistory = Pick<
  Transaction,
  | 'id'
  | 'accountId'
  | 'amount'
  | 'timestamp'
  | 'deviceId'
  | 'location'
  | 'txnType'
  | 'recipient'
  | 'agentId'
>;

const isRuleId = (id: string): id is RuleId => (RULE_IDS as readonly string[]).includes(id);

/** Rules as stored in the database, narrowed to the ones this engine knows. */
export function toEngineRules(
  rows: readonly {
    id: string;
    name: string;
    condition: string;
    points: number;
    enabled: boolean;
  }[],
): RuleConfig[] {
  return rows.flatMap((r) => (isRuleId(r.id) ? [{ ...r, id: r.id }] : []));
}

/** Stored history only feeds the rules, so fields the rules never read are left blank. */
function historyToEngine(tx: StoredHistory): Transaction {
  return { ...tx, customerName: '', currency: '', merchant: '', category: '', status: 'approved' };
}

/** A new row keeps every field, since reason texts quote some (e.g. the currency). */
function rowToEngine(row: ImportRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    customerName: row.customerName,
    amount: row.amount,
    currency: row.currency,
    merchant: row.merchant,
    category: row.category,
    location: { city: row.city, country: row.country },
    timestamp: row.timestamp,
    deviceId: row.deviceId,
    status: 'approved',
    txnType: row.txnType,
    recipient: row.recipientMsisdn,
    agentId: row.agentId,
  };
}

/**
 * Scores new rows the same way the engine's scoreAll does: in time order (ties by ID),
 * each seeing only its own account's earlier transactions. History is what is already
 * stored plus earlier rows from this file. Stored transactions are not re-scored here.
 */
export function scoreImport(
  rows: readonly ImportRow[],
  stored: readonly StoredHistory[],
  rules: readonly RuleConfig[],
): ScoredImportRow[] {
  type Entry = { tx: Transaction; row?: ImportRow };
  const byAccount = new Map<string, Entry[]>();
  const add = (entry: Entry) => {
    const list = byAccount.get(entry.tx.accountId) ?? [];
    list.push(entry);
    byAccount.set(entry.tx.accountId, list);
  };
  for (const tx of stored) add({ tx: historyToEngine(tx) });
  for (const row of rows) add({ tx: rowToEngine(row), row });

  const scored: ScoredImportRow[] = [];
  for (const entries of byAccount.values()) {
    entries.sort((a, b) => compareChronological(a.tx, b.tx));
    const history: Transaction[] = [];
    for (const { tx, row } of entries) {
      if (row) {
        const { score, reasons } = calculateFraudRisk(tx, history, rules);
        scored.push({
          ...row,
          riskScore: score,
          riskLevel: getRiskLevel(score),
          status: getStatus(score),
          reasons,
        });
      }
      history.push(tx);
    }
  }
  return scored.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
}
