import { DEFAULT_RULES } from '@sentinel/engine';
import request from 'supertest';
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
const CSV = [
  'Txn ID,Wallet,Name,Amount,Type,Date,Town,Country,IMEI,MSISDN',
  ...[1, 2, 3, 4, 5].map(
    (d) => `TX-${d},ACC-1,John Mensah,850,payment,2026-09-0${d} 12:00,Accra,Ghana,D-1,0244123601`,
  ),
  // Unusual amount +25, unusual time +10, new country +20, new device +15 = 70 (high).
  'TX-10482,ACC-1,John Mensah,"15,400",payment,2026-10-05 02:34,Lagos,Nigeria,D-921,0244123601',
].join('\n');

async function setUp() {
  const admin = await createUser('admin');
  await createUser('analyst');
  const adminCookie = await login(admin.email);
  const analystCookie = await login('analyst@example.com');
  const res = await request(app)
    .post(`/api/imports?mapping=${encodeURIComponent(JSON.stringify(MAPPING))}`)
    .set('Cookie', adminCookie)
    .set('Content-Type', 'text/csv')
    .send(Buffer.from(CSV));
  expect(res.status).toBe(201);
  return { admin, adminCookie, analystCookie };
}

const patchRule = (cookie: string, id: string, body: object) =>
  request(app).patch(`/api/rules/${id}`).set('Cookie', cookie).send(body);

describe('PATCH /api/rules/:id', () => {
  it('lets an admin change a rule, and audits the old and new settings', async () => {
    const { admin, adminCookie } = await setUp();
    const res = await patchRule(adminCookie, 'amount', { points: 40, enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.rule).toMatchObject({ id: 'amount', points: 40, enabled: false });
    expect(await prisma.rule.findUnique({ where: { id: 'amount' } })).toMatchObject({
      points: 40,
      enabled: false,
      updatedById: admin.id,
    });
    expect(await prisma.auditLog.findFirst({ where: { action: 'rule.update' } })).toMatchObject({
      actorId: admin.id,
      entityId: 'amount',
      detail: { before: { points: 25, enabled: true }, after: { points: 40, enabled: false } },
    });
  });

  it('does not re-score stored transactions by itself', async () => {
    const { adminCookie } = await setUp();
    await patchRule(adminCookie, 'amount', { enabled: false });
    const tx = await prisma.transaction.findUnique({ where: { id: 'TX-10482' } });
    expect(tx?.riskScore).toBe(70);
  });

  it('is for admins only', async () => {
    const { analystCookie } = await setUp();
    expect((await patchRule(analystCookie, 'amount', { points: 1 })).status).toBe(403);
    expect((await request(app).patch('/api/rules/amount').send({ points: 1 })).status).toBe(401);
  });

  it.each([
    ['points above 100', { points: 101 }],
    ['negative points', { points: -1 }],
    ['fractional points', { points: 2.5 }],
    ['an empty change', {}],
    ['an unknown field', { name: 'Renamed' }],
  ])('rejects %s', async (_label, body) => {
    const { adminCookie } = await setUp();
    const res = await patchRule(adminCookie, 'amount', body);
    expect(res.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { action: 'rule.update' } })).toBe(0);
  });

  it('answers 404 for an unknown rule', async () => {
    const { adminCookie } = await setUp();
    expect((await patchRule(adminCookie, 'nope', { points: 5 })).status).toBe(404);
  });
});

describe('re-scoring', () => {
  it('changes nothing when the rules have not changed', async () => {
    const { adminCookie } = await setUp();
    const res = await request(app).get('/api/rescore').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ total: 6, changed: 0, flaggedBefore: 1 });
    expect(res.body.summary.moves).toEqual([]);
  });

  it('previews without storing, then applies, keeping decisions', async () => {
    const { admin, adminCookie, analystCookie } = await setUp();
    await request(app)
      .post('/api/transactions/TX-10482/decisions')
      .set('Cookie', analystCookie)
      .send({ decision: 'confirmed_fraud', notes: 'Customer confirmed.' });
    await patchRule(adminCookie, 'amount', { enabled: false });
    await patchRule(adminCookie, 'country', { points: 0 });

    const preview = await request(app).get('/api/rescore').set('Cookie', adminCookie);
    expect(preview.body.summary).toMatchObject({
      total: 6,
      changed: 1,
      flaggedBefore: 1,
      flaggedAfter: 0, // 70 - 25 - 20 = 25: low
      newlyFlagged: 0,
      noLongerFlagged: 1,
      moves: [{ from: 'high', to: 'low', count: 1 }],
    });
    expect(preview.body.summary.levels).toContainEqual({ level: 'high', before: 1, after: 0 });
    expect((await prisma.transaction.findUnique({ where: { id: 'TX-10482' } }))?.riskScore).toBe(
      70,
    );

    const applied = await request(app).post('/api/rescore').set('Cookie', adminCookie);
    expect(applied.status).toBe(200);
    expect(applied.body.summary.changed).toBe(1);

    const detail = await request(app).get('/api/transactions/TX-10482').set('Cookie', adminCookie);
    expect(detail.body.transaction).toMatchObject({
      riskScore: 25,
      riskLevel: 'low',
      status: 'approved',
      reviewStatus: 'resolved',
      latestDecision: { decision: 'confirmed_fraud' },
    });
    // A switched-off rule no longer fires; a rule at 0 points still shows, adding nothing.
    expect(
      detail.body.transaction.fraudReasons.map(
        (r: { ruleId: string; points: number }) => `${r.ruleId} +${r.points}`,
      ),
    ).toEqual(['time +10', 'country +0', 'device +15']);
    expect(detail.body.decisions).toHaveLength(1);

    const entry = await prisma.auditLog.findFirst({ where: { action: 'rescore' } });
    expect(entry).toMatchObject({
      actorId: admin.id,
      detail: { total: 6, changed: 1, flaggedBefore: 1, flaggedAfter: 0 },
    });

    // Running it again finds nothing more to change.
    const again = await request(app).get('/api/rescore').set('Cookie', adminCookie);
    expect(again.body.summary.changed).toBe(0);
  });

  it('is for admins only', async () => {
    const { analystCookie } = await setUp();
    expect((await request(app).get('/api/rescore').set('Cookie', analystCookie)).status).toBe(403);
    expect((await request(app).post('/api/rescore').set('Cookie', analystCookie)).status).toBe(403);
  });
});

describe('GET /api/rules/feedback', () => {
  it('counts how often each rule fired on confirmed fraud and on false positives', async () => {
    const { analystCookie } = await setUp();
    // A change of mind: only the latest decision counts.
    const decide = (decision: string) =>
      request(app)
        .post('/api/transactions/TX-10482/decisions')
        .set('Cookie', analystCookie)
        .send({ decision, notes: 'Checked.' });
    await decide('false_positive');
    await decide('confirmed_fraud'); // the latest decision counts

    const res = await request(app).get('/api/rules/feedback').set('Cookie', analystCookie);
    expect(res.status).toBe(200);
    const byRule = Object.fromEntries(
      res.body.feedback.map((f: { ruleId: string }) => [f.ruleId, f]),
    );
    expect(byRule.amount).toEqual({
      ruleId: 'amount',
      fired: 1,
      confirmedFraud: 1,
      falsePositive: 0,
    });
    expect(byRule.rapid).toEqual({
      ruleId: 'rapid',
      fired: 0,
      confirmedFraud: 0,
      falsePositive: 0,
    });
    expect(res.body.feedback.map((f: { ruleId: string }) => f.ruleId)).toEqual(
      DEFAULT_RULES.map((r) => r.id),
    );
  });
});

describe('GET /api/audit', () => {
  it('lists entries newest first with who did them, filterable by action and person', async () => {
    const { admin, adminCookie } = await setUp();
    await patchRule(adminCookie, 'time', { points: 15 });

    const res = await request(app).get('/api/audit').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { action: string }) => e.action)).toEqual([
      'rule.update',
      'import',
      'login',
      'login',
    ]);
    expect(res.body.entries[0]).toMatchObject({
      entity: 'rule',
      entityId: 'time',
      actor: { id: admin.id, name: 'Test admin', email: admin.email },
      detail: { after: { points: 15 } },
    });
    expect(typeof res.body.entries[0].id).toBe('string');
    expect(res.body.filters.actions).toEqual(['import', 'login', 'rule.update']);
    expect(res.body.filters.actors.map((a: { name: string }) => a.name)).toEqual([
      'Test admin',
      'Test analyst',
    ]);

    const imports = await request(app).get('/api/audit?action=import').set('Cookie', adminCookie);
    expect(imports.body.total).toBe(1);
    const byAdmin = await request(app)
      .get(`/api/audit?actor=${admin.id}&pageSize=2`)
      .set('Cookie', adminCookie);
    expect(byAdmin.body).toMatchObject({ total: 3, page: 1, pageCount: 2 });
  });

  it('filters by day and refuses bad dates', async () => {
    const { adminCookie } = await setUp();
    const today = new Date().toISOString().slice(0, 10);
    const inRange = await request(app)
      .get(`/api/audit?from=${today}&to=${today}`)
      .set('Cookie', adminCookie);
    expect(inRange.body.total).toBe(3);
    const before = await request(app).get('/api/audit?to=2000-01-01').set('Cookie', adminCookie);
    expect(before.body.total).toBe(0);
    const bad = await request(app).get('/api/audit?from=yesterday').set('Cookie', adminCookie);
    expect(bad.status).toBe(400);
  });

  it('is for admins only', async () => {
    const { analystCookie } = await setUp();
    expect((await request(app).get('/api/audit').set('Cookie', analystCookie)).status).toBe(403);
  });
});
