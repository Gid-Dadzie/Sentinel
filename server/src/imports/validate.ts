import type { TxnType } from '@prisma/client';
import type { ColumnMapping, FieldKey } from './fields';

/** A spreadsheet cell as the readers return it. */
export type Cell = string | number | boolean | Date | null;

export const KNOWN_CURRENCIES = [
  'GHS',
  'NGN',
  'KES',
  'UGX',
  'TZS',
  'RWF',
  'XOF',
  'XAF',
  'ZAR',
  'ZMW',
  'USD',
  'EUR',
  'GBP',
  'AED',
] as const;
export const DEFAULT_CURRENCY = 'GHS';

/** One row after validation, ready to score and store. Phone numbers are already masked. */
export interface ImportRow {
  id: string;
  accountId: string;
  customerName: string;
  amount: number;
  currency: string;
  txnType: TxnType;
  timestamp: string; // "2026-10-05T02:34:00", wall-clock time as the engine expects
  merchant: string;
  category: string;
  city: string;
  country: string;
  deviceId: string;
  senderMsisdn: string;
  recipientMsisdn: string | null;
  agentId: string | null;
}

export type RowResult = { ok: true; row: ImportRow } | { ok: false; problems: string[] };

const MAX_TEXT = 100;

function text(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
}

// ---- Field parsers. Each returns the value, or a problem in plain language. ----

type Parsed<T> = { value: T } | { problem: string };

export function parseAmount(cell: Cell | undefined): Parsed<number> {
  let amount: number;
  if (typeof cell === 'number') {
    amount = cell;
  } else {
    // "15,400.00", "GHS 15,400", "15400 GHS"
    const cleaned = text(cell)
      .replace(/^[A-Za-z]{3}\s*|\s*[A-Za-z]{3}$/g, '')
      .replace(/,/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned))
      return { problem: `Amount "${text(cell)}" is not a number` };
    amount = Number(cleaned);
  }
  if (!Number.isFinite(amount) || amount <= 0) return { problem: 'Amount must be more than zero' };
  if (amount >= 1e12) return { problem: 'Amount is too large' };
  return { value: Math.round(amount * 100) / 100 };
}

const pad = (n: number) => String(n).padStart(2, '0');
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/**
 * Accepts "YYYY-MM-DD HH:MM[:SS]" (or with a T), a spreadsheet date cell, or an Excel
 * date serial. Times are wall-clock times as recorded; a time zone is not accepted
 * because the rules (night-time, travel speed) read the local time as written.
 */
export function parseTimestamp(cell: Cell | undefined): Parsed<string> {
  let date: Date;
  if (cell instanceof Date) {
    // The readers give Excel dates as UTC holding the wall-clock time. Excel keeps them
    // as fractions of a day, so 09:30 can come back as 09:29:59.999: round to the second.
    date = new Date(Math.round(cell.getTime() / 1000) * 1000);
  } else if (typeof cell === 'number' && cell > 1 && cell < 200_000) {
    date = new Date(EXCEL_EPOCH_MS + Math.round(cell * 86_400) * 1000);
  } else {
    const raw = text(cell);
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw);
    if (!m) {
      return { problem: `Date "${raw}" is not in the form YYYY-MM-DD HH:MM` };
    }
    const [year, month, day, hour, minute, second] = m.slice(1).map((part) => Number(part ?? 0));
    date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day, hour, minute, second));
    // Reject impossible dates such as 2026-02-30 instead of rolling them over.
    const exists =
      date.getUTCDate() === day &&
      date.getUTCMonth() === (month ?? 1) - 1 &&
      (hour ?? 0) < 24 &&
      (minute ?? 0) < 60;
    if (!exists) return { problem: `Date "${raw}" does not exist` };
  }
  if (Number.isNaN(date.getTime())) return { problem: 'Date is not valid' };
  return {
    value:
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
      `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  };
}

const TXN_TYPE_ALIASES: Record<string, TxnType> = {
  cash_in: 'cash_in',
  cashin: 'cash_in',
  deposit: 'cash_in',
  cash_out: 'cash_out',
  cashout: 'cash_out',
  withdrawal: 'cash_out',
  withdraw: 'cash_out',
  transfer: 'transfer',
  p2p: 'transfer',
  send_money: 'transfer',
  sendmoney: 'transfer',
  airtime: 'airtime',
  topup: 'airtime',
  top_up: 'airtime',
  airtime_topup: 'airtime',
  payment: 'payment',
  merchant_payment: 'payment',
  pay: 'payment',
  bill_payment: 'payment',
};

export function parseTxnType(cell: Cell | undefined): Parsed<TxnType> {
  const raw = text(cell);
  const type = TXN_TYPE_ALIASES[raw.toLowerCase().replace(/[\s-]+/g, '_')];
  return type
    ? { value: type }
    : { problem: `Type "${raw}" is not one of cash in, cash out, transfer, airtime, payment` };
}

export function parseCurrency(cell: Cell | undefined): Parsed<string> {
  const raw = text(cell).toUpperCase();
  if (raw === '') return { value: DEFAULT_CURRENCY };
  return (KNOWN_CURRENCIES as readonly string[]).includes(raw)
    ? { value: raw }
    : { problem: `Currency "${raw}" is not a known currency code` };
}

/** "0244123601" -> "024****601". Already-masked numbers are kept. Nothing longer is stored. */
export function maskMsisdn(cell: Cell | undefined, label: string): Parsed<string> {
  const raw = text(cell).replace(/\s/g, '');
  if (/^\+?\d{3}\*{2,}\d{3}$/.test(raw)) return { value: raw.replace(/^\+/, '') };
  const digits = raw.replace(/^\+/, '');
  if (!/^\d{7,15}$/.test(digits)) return { problem: `${label} is not a valid phone number` };
  return { value: `${digits.slice(0, 3)}****${digits.slice(-3)}` };
}

// ---- Whole row ----

/** Validates one row and lists every problem in it, not just the first. */
export function validateRow(
  cells: readonly Cell[],
  headers: readonly string[],
  mapping: ColumnMapping,
): RowResult {
  const get = (key: FieldKey): Cell | undefined => {
    const header = mapping[key];
    return header === undefined ? undefined : cells[headers.indexOf(header)];
  };
  const problems: string[] = [];

  /**
   * Reads one field. A blank required field is reported as missing; a blank optional
   * one gives `fallback`. Anything else goes through `parse`, whose problem is recorded.
   */
  function field<T>(
    key: FieldKey,
    label: string,
    parse: (cell: Cell | undefined) => Parsed<T>,
    fallback: T,
    isRequired = true,
  ): T {
    const cell = get(key);
    if (text(cell) === '') {
      if (isRequired) problems.push(`${label} is missing`);
      return fallback;
    }
    const result = parse(cell);
    if ('problem' in result) {
      problems.push(result.problem);
      return fallback;
    }
    return result.value;
  }
  const plain =
    (label: string) =>
    (cell: Cell | undefined): Parsed<string> => {
      const value = text(cell);
      return value.length > MAX_TEXT
        ? { problem: `${label} is longer than ${MAX_TEXT} characters` }
        : { value };
    };
  const textField = (key: FieldKey, label: string, isRequired = true) =>
    field(key, label, plain(label), '', isRequired);

  const id = textField('id', 'Transaction ID');
  const accountId = textField('accountId', 'Account ID');
  const amount = field('amount', 'Amount', parseAmount, 0);
  const txnType = field<TxnType>('txnType', 'Transaction type', parseTxnType, 'payment');
  const timestamp = field('timestamp', 'Date and time', parseTimestamp, '');
  const currency = field('currency', 'Currency', parseCurrency, DEFAULT_CURRENCY, false);
  const city = textField('city', 'City');
  const country = textField('country', 'Country');
  const deviceId = textField('deviceId', 'Device ID');
  const senderMsisdn = field(
    'senderMsisdn',
    'Sender phone',
    (cell) => maskMsisdn(cell, 'Sender phone'),
    '',
  );
  const recipientMsisdn = field<string | null>(
    'recipientMsisdn',
    'Recipient phone',
    (cell) => maskMsisdn(cell, 'Recipient phone'),
    null,
    false,
  );
  const customerName = textField('customerName', 'Customer name', false);
  const merchant = textField('merchant', 'Merchant', false);
  const category = textField('category', 'Category', false);
  const agentId = textField('agentId', 'Agent ID', false);

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    row: {
      id,
      accountId,
      customerName: customerName || accountId,
      amount,
      currency,
      txnType,
      timestamp,
      merchant,
      category: category || 'uncategorised',
      city,
      country,
      deviceId,
      senderMsisdn,
      recipientMsisdn,
      agentId: agentId || null,
    },
  };
}
