import { apiFetch, json } from './client';
import type { ColumnMapping, ImportPreview, ImportReport } from './types';

/** The file goes as the raw request body; the server detects CSV or Excel from its bytes. */
function fileRequest(file: File): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  };
}

/** Reads the file's columns and a sample, and suggests a mapping. Stores nothing. */
export function previewImport(file: File): Promise<ImportPreview> {
  return apiFetch('/api/imports/preview', fileRequest(file));
}

/** Validates, scores and stores the rows; returns the import report. */
export function runImport(file: File, mapping: ColumnMapping): Promise<ImportReport> {
  const query = encodeURIComponent(JSON.stringify(mapping));
  return apiFetch(`/api/imports?mapping=${query}`, fileRequest(file));
}

/** Problems the server would reject the mapping for, checked before sending. */
export function mappingProblems(preview: ImportPreview, mapping: ColumnMapping): string[] {
  const problems: string[] = [];
  for (const field of preview.fields) {
    if (field.required && !mapping[field.key]) problems.push(`Choose a column for ${field.label}`);
  }
  const used = new Map<string, string>();
  for (const field of preview.fields) {
    const column = mapping[field.key];
    if (!column) continue;
    const other = used.get(column);
    if (other) problems.push(`"${column}" is used for both ${other} and ${field.label}`);
    else used.set(column, field.label);
  }
  return problems;
}

/** Must match the server; makes clearing a deliberate act rather than a stray request. */
const CLEAR_CONFIRMATION = 'delete all transactions';

/** Deletes every stored transaction and its decisions. Users, rules and the audit log stay. */
export function clearTransactions(): Promise<{
  deleted: { transactions: number; decisions: number };
}> {
  return apiFetch('/api/transactions', json('DELETE', { confirm: CLEAR_CONFIRMATION }));
}
