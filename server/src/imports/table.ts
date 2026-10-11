import { readSheet } from 'read-excel-file/node';
import { HttpError } from '../http';
import { parseCsv } from './csv';
import type { Cell } from './validate';

export const MAX_ROWS = 50_000;

/** A file's header row and data rows, whichever format it came in. */
export interface Table {
  format: 'csv' | 'xlsx';
  headers: string[];
  rows: Cell[][];
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // .xlsx files are zip archives
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .xls

const startsWith = (buf: Buffer, magic: number[]) => magic.every((byte, i) => buf[i] === byte);

/** Spreadsheet readers' cell types are loose; keep only what a cell can really hold. */
function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean')
    return value;
  return String(value);
}

/** Reads a CSV or .xlsx upload. Detects the format from the bytes, not the file name. */
export async function readTable(file: Buffer): Promise<Table> {
  if (file.length === 0) throw new HttpError(400, 'The file is empty');
  if (startsWith(file, OLE_MAGIC)) {
    throw new HttpError(400, 'Old .xls files are not supported. Save it as .xlsx or CSV.');
  }

  let format: Table['format'];
  let grid: Cell[][];
  if (startsWith(file, ZIP_MAGIC)) {
    format = 'xlsx';
    try {
      grid = (await readSheet(file)).map((row) => row.map(toCell));
    } catch {
      throw new HttpError(400, 'The Excel file could not be read');
    }
  } else {
    format = 'csv';
    const text = new TextDecoder('utf-8', { fatal: false }).decode(file);
    if (text.includes('\u0000')) throw new HttpError(400, 'The file is not a CSV or Excel file');
    grid = parseCsv(text);
  }

  const [headerRow, ...rows] = grid;
  if (!headerRow) throw new HttpError(400, 'The file has no header row');
  const headers = headerRow.map((cell, i) => {
    const name = cell === null ? '' : String(cell).trim();
    return name || `Column ${i + 1}`;
  });
  if (new Set(headers).size !== headers.length) {
    throw new HttpError(400, 'Two columns have the same heading. Rename one and try again.');
  }
  if (rows.length === 0) throw new HttpError(400, 'The file has a header row but no data');
  if (rows.length > MAX_ROWS) {
    throw new HttpError(400, `The file has ${rows.length} rows; the limit is ${MAX_ROWS}`);
  }
  return { format, headers, rows };
}
