import { DEFAULT_RULES } from '@sentinel/engine';
import request from 'supertest';
import writeXlsxFile from 'write-excel-file/node';
import { app, createUser, login, prisma, resetDatabase } from '../test/helpers';

beforeEach(async () => {
  await resetDatabase();
  await prisma.rule.createMany({
    data: DEFAULT_RULES.map(({ id, name, condition, points, enabled }) => ({
      id,
      name,
      condition,
      points,
      enabled,
    })),
  });
});
afterAll(() => prisma.$disconnect());

const HEADER = 'Txn ID,Wallet,Name,Amount,Type,Date,Town,Country,IMEI,MSISDN';
const MAPPING = {
  id: 'Txn ID',
  accountId: 'Wallet',
  customerName: 'Name',
  amount: 'Amount',
  txnType: 'Type',
  timestamp: 'Date',
  city: 'Town',
  country: 'Country',
  deviceId: 'IMEI',
  senderMsisdn: 'MSISDN',
};

/** An ordinary noon payment for one wallet on day `d` of September. */
const normal = (d: number) =>
  `TX-${d},ACC-1,John Mensah,850,payment,2026-09-0${d} 12:00,Accra,Ghana,D-1,0244123601`;
/** Five ordinary days, then the TX-10482-style anomaly. */
const NORMAL = [1, 2, 3, 4, 5].map(normal);
const ANOMALY =
  'TX-10482,ACC-1,John Mensah,"15,400",payment,2026-10-05 02:34,Lagos,Nigeria,D-921,0244123601';
const csv = (...lines: string[]) => Buffer.from([HEADER, ...lines].join('\r\n'));

async function adminCookie() {
  await createUser('admin');
  return login('admin@example.com');
}

function upload(cookie: string, file: Buffer, mapping: object = MAPPING, name = 'october.csv') {
  return request(app)
    .post(`/api/imports?mapping=${encodeURIComponent(JSON.stringify(mapping))}`)
    .set('Cookie', cookie)
    .set('Content-Type', 'application/octet-stream')
    .set('X-File-Name', encodeURIComponent(name))
    .send(file);
}

describe('POST /api/imports/preview', () => {
  it('reads the headers and a sample, and suggests a mapping', async () => {
    const res = await request(app)
      .post('/api/imports/preview')
      .set('Cookie', await adminCookie())
      .set('Content-Type', 'text/csv')
      .set('X-File-Name', 'october.csv')
      .send(csv(...NORMAL));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fileName: 'october.csv',
      format: 'csv',
      headers: HEADER.split(','),
      rowCount: 5,
      suggestedMapping: { ...MAPPING, customerName: 'Name' },
    });
    expect(res.body.sample).toHaveLength(5);
    // Phone numbers are masked even in the preview; short numbers like amounts are not.
    expect(res.body.sample[0]).toEqual([
      'TX-1',
      'ACC-1',
      'John Mensah',
      '850',
      'payment',
      '2026-09-01 12:00',
      'Accra',
      'Ghana',
      'D-1',
      '024****601',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('0244123601');
    expect(res.body.fields.find((f: { key: string }) => f.key === 'amount')).toEqual({
      key: 'amount',
      label: 'Amount',
      required: true,
    });
    expect(await prisma.transaction.count()).toBe(0); // a preview stores nothing
  });

  it('reads Excel files, including real date cells', async () => {
    const file = await writeXlsxFile([
      HEADER.split(',').map((value) => ({ value })),
      [
        { value: 'TX-1' },
        { value: 'ACC-1' },
        { value: 'Ama' },
        { value: 120 },
        { value: 'payment' },
        { value: new Date(Date.UTC(2026, 9, 1, 9, 30)), format: 'yyyy-mm-dd hh:mm' },
        { value: 'Accra' },
        { value: 'Ghana' },
        { value: 'D-1' },
        { value: '0244123601' },
      ],
    ]).toBuffer();
    const cookie = await adminCookie();
    const preview = await request(app)
      .post('/api/imports/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/octet-stream')
      .send(file);
    expect(preview.status).toBe(200);
    expect(preview.body.format).toBe('xlsx');

    const res = await upload(cookie, file, MAPPING, 'october.xlsx');
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: 'TX-1' } });
    expect(stored.timestamp.toISOString()).toBe('2026-10-01T09:30:00.000Z');
  });

  it('turns away old .xls files and empty uploads with a clear message', async () => {
    const cookie = await adminCookie();
    const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const res = await request(app)
      .post('/api/imports/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/octet-stream')
      .send(xls);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Old .xls files are not supported. Save it as .xlsx or CSV.');

    const empty = await request(app)
      .post('/api/imports/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'text/csv')
      .send(Buffer.from(HEADER));
    expect(empty.body.error).toBe('The file has a header row but no data');
  });
});

describe('POST /api/imports', () => {
  it('scores rows against stored history, masks phones and saves reasons', async () => {
    const cookie = await adminCookie();
    expect((await upload(cookie, csv(...NORMAL))).body.imported).toBe(5);

    // A second file: the anomaly is scored against the five stored transactions.
    const res = await upload(cookie, csv(ANOMALY));
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      fileName: 'october.csv',
      totalRows: 1,
      imported: 1,
      flagged: 1,
      rejected: [],
      duplicates: [],
    });

    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: 'TX-10482' },
      include: { reasons: { orderBy: { id: 'asc' } } },
    });
    expect(tx).toMatchObject({
      riskScore: 70,
      riskLevel: 'high',
      status: 'pending',
      reviewStatus: 'new',
      senderMsisdn: '024****601',
      currency: 'GHS',
      txnType: 'payment',
    });
    expect(tx.amount.toNumber()).toBe(15400);
    expect(tx.reasons.map((r) => [r.ruleId, r.points])).toEqual([
      ['amount', 25],
      ['time', 10],
      ['country', 20],
      ['device', 15],
    ]);
    const all = JSON.stringify(await prisma.transaction.findMany());
    expect(all).not.toContain('0244123601');
  });

  it('uses the rules as stored: a disabled rule adds nothing', async () => {
    await prisma.rule.update({ where: { id: 'time' }, data: { enabled: false } });
    const cookie = await adminCookie();
    await upload(cookie, csv(...NORMAL, ANOMALY));
    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: 'TX-10482' },
      include: { reasons: true },
    });
    expect(tx.riskScore).toBe(60);
    expect(tx.reasons.map((r) => r.ruleId)).not.toContain('time');
  });

  it('reports every rejected row with its reasons and imports the rest', async () => {
    const cookie = await adminCookie();
    const res = await upload(
      cookie,
      csv(
        normal(1),
        'TX-BAD,ACC-1,John,-5,refund,2026-09-02 12:00,Accra,Ghana,D-1,0244123601',
        ',ACC-1,John,10,payment,someday,Accra,Ghana,D-1,0244123601',
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    expect(res.body.rejected).toEqual([
      {
        row: 3,
        id: 'TX-BAD',
        problems: [
          'Amount must be more than zero',
          'Type "refund" is not one of cash in, cash out, transfer, airtime, payment',
        ],
      },
      {
        row: 4,
        id: null,
        problems: [
          'Transaction ID is missing',
          'Date "someday" is not in the form YYYY-MM-DD HH:MM',
        ],
      },
    ]);
  });

  it('skips duplicate IDs, both repeated in the file and already imported', async () => {
    const cookie = await adminCookie();
    await upload(cookie, csv(normal(1)));
    const res = await upload(cookie, csv(normal(1), normal(2), normal(2)));
    expect(res.body.imported).toBe(1);
    expect(res.body.duplicates).toEqual([
      { row: 2, id: 'TX-1', problems: ['Already imported'] },
      { row: 4, id: 'TX-2', problems: ['Same ID as row 3'] },
    ]);
    expect(await prisma.transaction.count()).toBe(2);
  });

  it('records the import in the audit log', async () => {
    const cookie = await adminCookie();
    await upload(cookie, csv(...NORMAL, ANOMALY));
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: 'import' } });
    expect(entry.detail).toEqual({
      fileName: 'october.csv',
      format: 'csv',
      totalRows: 6,
      imported: 6,
      flagged: 1,
      rejected: 0,
      duplicates: 0,
    });
  });

  it('refuses an incomplete mapping before reading any row', async () => {
    const cookie = await adminCookie();
    const { amount: _amount, ...withoutAmount } = MAPPING;
    const res = await upload(cookie, csv(...NORMAL), withoutAmount);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'The column mapping is incomplete',
      details: ['Amount must be mapped to a column'],
    });
    const unknown = await upload(cookie, csv(...NORMAL), { ...MAPPING, password: 'Name' });
    expect(unknown.body.error).toBe('Unknown field in the column mapping: password');
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('is for admins only', async () => {
    await createUser('analyst');
    const cookie = await login('analyst@example.com');
    expect((await upload(cookie, csv(...NORMAL))).status).toBe(403);
    expect((await upload('', csv(...NORMAL))).status).toBe(401);
    expect(await prisma.transaction.count()).toBe(0);
  });
});
