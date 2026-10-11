import type { PrismaClient } from '@prisma/client';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { HttpError } from '../http';
import {
  FIELD_KEYS,
  IMPORT_FIELDS,
  mappingProblems,
  suggestMapping,
  type ColumnMapping,
} from '../imports/fields';
import { runImport } from '../imports/runImport';
import { readTable } from '../imports/table';
import type { Cell } from '../imports/validate';

const MAX_FILE = '10mb';
const SAMPLE_ROWS = 5;

/**
 * The preview runs before columns are mapped, so it cannot know which column holds
 * phone numbers. Anything shaped like one (9 to 15 digits) is masked, so full numbers
 * never travel back to the browser.
 */
export function maskPhoneLike(cell: Cell): Cell {
  if (typeof cell !== 'string' && typeof cell !== 'number') return cell;
  const raw = String(cell).trim();
  if (!/^\+?[\d\s-]+$/.test(raw)) return cell;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15
    ? `${digits.slice(0, 3)}****${digits.slice(-3)}`
    : cell;
}

/** The file is the raw request body; its name travels in a header (URL-encoded). */
function fileName(req: Request): string {
  const header = req.get('X-File-Name');
  try {
    return header ? decodeURIComponent(header).slice(0, 200) : 'upload';
  } catch {
    return 'upload';
  }
}

function fileBody(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, 'Send the file as the request body');
  }
  return req.body;
}

const mappingSchema = z.record(z.string(), z.string().min(1).max(200));
const isFieldKey = (key: string) => (FIELD_KEYS as readonly string[]).includes(key);

function parseMapping(req: Request): ColumnMapping {
  const raw = req.query.mapping;
  if (typeof raw !== 'string') throw new HttpError(400, 'Add the column mapping (?mapping=...)');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'The column mapping is not valid JSON');
  }
  const result = mappingSchema.safeParse(json);
  if (!result.success)
    throw new HttpError(400, 'The column mapping must map field names to columns');
  const unknown = Object.keys(result.data).filter((key) => !isFieldKey(key));
  if (unknown.length > 0) {
    throw new HttpError(400, `Unknown field in the column mapping: ${unknown.join(', ')}`);
  }
  const mapping: ColumnMapping = {};
  for (const key of FIELD_KEYS) {
    const header = result.data[key];
    if (header !== undefined) mapping[key] = header;
  }
  return mapping;
}

/** Imports are an admin task (DOCUMENTATION.md 9.8). Mounted behind requireAuth. */
export function importsRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireRole('admin'));
  router.use(express.raw({ type: () => true, limit: MAX_FILE }));

  /** Reads the file and proposes a mapping. Nothing is stored. */
  router.post('/preview', async (req, res) => {
    const table = await readTable(fileBody(req));
    res.json({
      fileName: fileName(req),
      format: table.format,
      headers: table.headers,
      sample: table.rows.slice(0, SAMPLE_ROWS).map((row) => row.map(maskPhoneLike)),
      rowCount: table.rows.length,
      fields: IMPORT_FIELDS.map(({ key, label, required }) => ({ key, label, required })),
      suggestedMapping: suggestMapping(table.headers),
    });
  });

  /** Validates, scores and stores the rows; answers with the import report. */
  router.post('/', async (req, res) => {
    const mapping = parseMapping(req);
    const table = await readTable(fileBody(req));
    const problems = mappingProblems(mapping, table.headers);
    if (problems.length > 0) {
      throw new HttpError(400, 'The column mapping is incomplete', problems);
    }
    const report = await runImport(prisma, table, mapping, fileName(req), res.locals.user.id);
    res.status(201).json(report);
  });

  return router;
}
