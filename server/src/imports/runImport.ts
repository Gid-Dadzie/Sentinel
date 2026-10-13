import type { PrismaClient } from '@prisma/client';
import { isFlagged } from '@sentinel/engine';
import { audit } from '../audit';
import { fromDbTime, toDbTime } from '../dbTime';
import type { ColumnMapping } from './fields';
import { scoreImport, toEngineRules, type StoredHistory } from './score';
import type { Table } from './table';
import { validateRow, type ImportRow } from './validate';

/** Rows are numbered as a spreadsheet shows them: the header is row 1. */
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
  /** Rows not imported because they break a validation rule. */
  rejected: RejectedRow[];
  /** Rows skipped because their transaction ID was already imported or repeated in the file. */
  duplicates: RejectedRow[];
}

const CHUNK = 1000;
const chunks = <T>(items: readonly T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

/**
 * Validates every row, skips duplicates, scores the rest against each account's stored
 * history and saves them with their reasons in one database transaction. Never drops a
 * row silently: each one is imported, rejected with reasons, or listed as a duplicate.
 */
export async function runImport(
  prisma: PrismaClient,
  table: Table,
  mapping: ColumnMapping,
  fileName: string,
  actorId: string,
): Promise<ImportReport> {
  const rejected: RejectedRow[] = [];
  const duplicates: RejectedRow[] = [];
  const valid: { rowNumber: number; row: ImportRow }[] = [];
  const firstRowForId = new Map<string, number>();

  table.rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const result = validateRow(cells, table.headers, mapping);
    if (!result.ok) {
      const idHeader = mapping.id;
      const rawId = idHeader === undefined ? null : cells[table.headers.indexOf(idHeader)];
      rejected.push({
        row: rowNumber,
        id: rawId ? String(rawId).trim() : null,
        problems: result.problems,
      });
      return;
    }
    const earlier = firstRowForId.get(result.row.id);
    if (earlier !== undefined) {
      duplicates.push({
        row: rowNumber,
        id: result.row.id,
        problems: [`Same ID as row ${earlier}`],
      });
      return;
    }
    firstRowForId.set(result.row.id, rowNumber);
    valid.push({ rowNumber, row: result.row });
  });

  // IDs that are already in the database.
  const existing = new Set<string>();
  for (const ids of chunks(valid.map((v) => v.row.id))) {
    const found = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    for (const { id } of found) existing.add(id);
  }
  const fresh = valid.filter(({ rowNumber, row }) => {
    if (!existing.has(row.id)) return true;
    duplicates.push({ row: rowNumber, id: row.id, problems: ['Already imported'] });
    return false;
  });

  const accountIds = [...new Set(fresh.map((f) => f.row.accountId))];
  const storedRows = accountIds.length
    ? await prisma.transaction.findMany({
        where: { accountId: { in: accountIds } },
        select: {
          id: true,
          accountId: true,
          amount: true,
          timestamp: true,
          deviceId: true,
          city: true,
          country: true,
          txnType: true,
          recipientMsisdn: true,
          agentId: true,
        },
      })
    : [];
  const stored: StoredHistory[] = storedRows.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    amount: t.amount.toNumber(),
    timestamp: fromDbTime(t.timestamp),
    deviceId: t.deviceId,
    location: { city: t.city, country: t.country },
    txnType: t.txnType,
    recipient: t.recipientMsisdn,
    agentId: t.agentId,
  }));
  const rules = toEngineRules(await prisma.rule.findMany());
  const scored = scoreImport(
    fresh.map((f) => f.row),
    stored,
    rules,
  );

  await prisma.$transaction(
    async (tx) => {
      for (const batch of chunks(scored)) {
        await tx.transaction.createMany({
          data: batch.map(({ reasons: _reasons, timestamp, ...row }) => ({
            ...row,
            timestamp: toDbTime(timestamp),
          })),
        });
        await tx.fraudReason.createMany({
          data: batch.flatMap((row) =>
            row.reasons.map((r) => ({
              transactionId: row.id,
              ruleId: r.ruleId,
              points: r.points,
              text: r.text,
            })),
          ),
        });
      }
    },
    { timeout: 120_000 },
  );

  const report: ImportReport = {
    fileName,
    totalRows: table.rows.length,
    imported: scored.length,
    flagged: scored.filter((s) => isFlagged(s.riskScore)).length,
    rejected,
    duplicates: duplicates.sort((a, b) => a.row - b.row),
  };
  await audit(prisma, {
    actorId,
    action: 'import',
    entity: 'import',
    detail: {
      fileName,
      format: table.format,
      totalRows: report.totalRows,
      imported: report.imported,
      flagged: report.flagged,
      rejected: rejected.length,
      duplicates: duplicates.length,
    },
  });
  return report;
}
