import { parseCsv } from '../csv';
import { mappingProblems, suggestMapping } from '../fields';
import {
  maskMsisdn,
  parseAmount,
  parseCurrency,
  parseTimestamp,
  parseTxnType,
  validateRow,
} from '../validate';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks inside quotes, CRLF and a BOM', () => {
    const text = '﻿id,merchant,note\r\n1,"Shop, Ltd","said ""hi"""\r\n2,Kiosk,"two\nlines"\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['id', 'merchant', 'note'],
      ['1', 'Shop, Ltd', 'said "hi"'],
      ['2', 'Kiosk', 'two\nlines'],
    ]);
  });

  it('detects semicolon-separated files', () => {
    expect(parseCsv('id;amount\n1;"1,5"')).toEqual([
      ['id', 'amount'],
      ['1', '1,5'],
    ]);
  });
});

describe('field parsers', () => {
  it('reads amounts with separators and currency codes, and rejects zero, negatives and text', () => {
    expect(parseAmount('15,400.00')).toEqual({ value: 15400 });
    expect(parseAmount('GHS 850.5')).toEqual({ value: 850.5 });
    expect(parseAmount(12.345)).toEqual({ value: 12.35 });
    expect(parseAmount('0')).toEqual({ problem: 'Amount must be more than zero' });
    expect(parseAmount('-5')).toEqual({ problem: 'Amount must be more than zero' });
    expect(parseAmount('ten')).toEqual({ problem: 'Amount "ten" is not a number' });
  });

  it('reads timestamps as wall-clock time and rejects other formats and impossible dates', () => {
    expect(parseTimestamp('2026-10-05 02:34')).toEqual({ value: '2026-10-05T02:34:00' });
    expect(parseTimestamp('2026-10-05T02:34:09.5')).toEqual({ value: '2026-10-05T02:34:09' });
    expect(parseTimestamp(new Date(Date.UTC(2026, 9, 5, 2, 34)))).toEqual({
      value: '2026-10-05T02:34:00',
    });
    expect(parseTimestamp(46300.5)).toEqual({ value: '2026-10-05T12:00:00' }); // Excel serial
    expect(parseTimestamp('05/10/2026 02:34')).toEqual({
      problem: 'Date "05/10/2026 02:34" is not in the form YYYY-MM-DD HH:MM',
    });
    expect(parseTimestamp('2026-02-30 10:00')).toEqual({
      problem: 'Date "2026-02-30 10:00" does not exist',
    });
    expect(parseTimestamp('2026-10-05')).toHaveProperty('problem');
  });

  it('understands common names for transaction types', () => {
    expect(parseTxnType('Cash Out')).toEqual({ value: 'cash_out' });
    expect(parseTxnType('DEPOSIT')).toEqual({ value: 'cash_in' });
    expect(parseTxnType('p2p')).toEqual({ value: 'transfer' });
    expect(parseTxnType('refund')).toHaveProperty('problem');
  });

  it('defaults a blank currency to GHS and rejects unknown codes', () => {
    expect(parseCurrency('')).toEqual({ value: 'GHS' });
    expect(parseCurrency('ngn')).toEqual({ value: 'NGN' });
    expect(parseCurrency('XYZ')).toEqual({
      problem: 'Currency "XYZ" is not a known currency code',
    });
  });

  it('masks phone numbers and never keeps the middle digits', () => {
    expect(maskMsisdn('0244 123 601', 'Phone')).toEqual({ value: '024****601' });
    expect(maskMsisdn('+233244123601', 'Phone')).toEqual({ value: '233****601' });
    expect(maskMsisdn(244123601, 'Phone')).toEqual({ value: '244****601' });
    expect(maskMsisdn('024****601', 'Phone')).toEqual({ value: '024****601' });
    expect(maskMsisdn('12ab', 'Phone')).toEqual({ problem: 'Phone is not a valid phone number' });
  });
});

describe('mapping', () => {
  const headers = [
    'Txn ID',
    'Wallet',
    'Amount',
    'Type',
    'Date',
    'Town',
    'Country',
    'IMEI',
    'MSISDN',
  ];

  it('suggests a mapping from common header names', () => {
    expect(suggestMapping(headers)).toEqual({
      id: 'Txn ID',
      accountId: 'Wallet',
      amount: 'Amount',
      txnType: 'Type',
      timestamp: 'Date',
      city: 'Town',
      country: 'Country',
      deviceId: 'IMEI',
      senderMsisdn: 'MSISDN',
    });
  });

  it('reports unmapped required fields, unknown columns and columns used twice', () => {
    expect(
      mappingProblems({ ...suggestMapping(headers), amount: 'Value', city: 'Country' }, headers),
    ).toEqual([
      'Amount is mapped to "Value", which is not in the file',
      'Column "Country" is mapped to both city and country',
    ]);
    expect(mappingProblems({}, headers)).toHaveLength(9);
  });
});

describe('validateRow', () => {
  const headers = ['id', 'account', 'amount', 'type', 'when', 'city', 'country', 'device', 'phone'];
  const mapping = {
    id: 'id',
    accountId: 'account',
    amount: 'amount',
    txnType: 'type',
    timestamp: 'when',
    city: 'city',
    country: 'country',
    deviceId: 'device',
    senderMsisdn: 'phone',
  };

  it('builds a clean row with defaults for optional fields', () => {
    const result = validateRow(
      [
        'TX-1',
        'ACC-1',
        '120',
        'payment',
        '2026-10-01 09:00',
        'Accra',
        'Ghana',
        'D-1',
        '0244123601',
      ],
      headers,
      mapping,
    );
    expect(result).toEqual({
      ok: true,
      row: {
        id: 'TX-1',
        accountId: 'ACC-1',
        customerName: 'ACC-1',
        amount: 120,
        currency: 'GHS',
        txnType: 'payment',
        timestamp: '2026-10-01T09:00:00',
        merchant: '',
        category: 'uncategorised',
        city: 'Accra',
        country: 'Ghana',
        deviceId: 'D-1',
        senderMsisdn: '024****601',
        recipientMsisdn: null,
        agentId: null,
      },
    });
  });

  it('lists every problem in the row, not just the first', () => {
    const result = validateRow(
      ['', 'ACC-1', '-3', 'refund', 'yesterday', '', 'Ghana', 'D-1', 'x'],
      headers,
      mapping,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        'Transaction ID is missing',
        'Amount must be more than zero',
        'Type "refund" is not one of cash in, cash out, transfer, airtime, payment',
        'Date "yesterday" is not in the form YYYY-MM-DD HH:MM',
        'City is missing',
        'Sender phone is not a valid phone number',
      ],
    });
  });
});
