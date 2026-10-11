import type { Prisma } from '@prisma/client';
import { DEFAULT_RULES, getRiskLevel, getStatus } from '@sentinel/engine';
import request from 'supertest';
import { toDbTime } from '../dbTime';
import { app, createUser, login, prisma, resetDatabase } from '../test/helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

interface TxInput {
  id: string;
  accountId?: string;
  customerName?: string;
  amount?: number;
  score?: number;
  timestamp?: string;
  city?: string;
  country?: string;
  merchant?: string;
  reasons?: { ruleId: string; points: number; text: string }[];
}

/** Stores a transaction directly, scored as given. */
async function addTx({
  id,
  accountId = 'ACC-1',
  customerName = 'John Mensah',
  amount = 850,
  score = 0,
  timestamp = '2026-09-01T12:00:00',
  city = 'Accra',
  country = 'Ghana',
  merchant = 'Melcom',
  reasons = [],
}: TxInput) {
  const data: Prisma.TransactionCreateInput = {
    id,
    accountId,
    customerName,
    amount,
    currency: 'GHS',
    txnType: 'payment',
    merchant,
    category: 'retail',
    city,
    country,
    timestamp: toDbTime(timestamp),
    deviceId: 'D-1',
    senderMsisdn: '024****601',
    riskScore: score,
    riskLevel: getRiskLevel(score),
    status: getStatus(score),
    reasons: { create: reasons },
  };
  await prisma.transaction.create({ data });
}

async function seed() {
  await addTx({ id: 'TX-1', timestamp: '2026-09-01T12:00:00' });
  await addTx({ id: 'TX-2', timestamp: '2026-09-02T12:00:00', amount: 1200, score: 30 });
  await addTx({
    id: 'TX-3',
    timestamp: '2026-09-02T02:34:00',
    amount: 15400,
    score: 80,
    city: 'Lagos',
    country: 'Nigeria',
    reasons: [
      { ruleId: 'amount', points: 25, text: 'Amount is 18x the average' },
      { ruleId: 'country', points: 20, text: 'First transaction in Nigeria' },
      { ruleId: 'retired_rule', points: 5, text: 'No longer in the engine' },
    ],
  });
  await addTx({
    id: 'TX-4',
    accountId: 'ACC-2',
    customerName: 'Ama Owusu',
    timestamp: '2026-09-03T09:00:00',
    amount: 400,
    score: 60,
    merchant: 'Shoprite',
  });
}

async function analystCookie() {
  await createUser('analyst');
  return login('analyst@example.com');
}

const get = (path: string, cookie: string) => request(app).get(path).set('Cookie', cookie);
const decide = (id: string, cookie: string, body: object) =>
  request(app).post(`/api/transactions/${id}/decisions`).set('Cookie', cookie).send(body);
const ids = (items: { id: string }[]) => items.map((t) => t.id);

describe('signed-out requests', () => {
  it.each([
    ['GET', '/api/transactions'],
    ['GET', '/api/transactions/TX-1'],
    ['POST', '/api/transactions/TX-1/decisions'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/customers/ACC-1'],
    ['GET', '/api/rules'],
  ])('%s %s answers 401', async (method, path) => {
    const res = await (method === 'GET' ? request(app).get(path) : request(app).post(path));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/transactions', () => {
  it('lists newest first in the engine shape, with masked phones and wall-clock times', async () => {
    await seed();
    const res = await get('/api/transactions', await analystCookie());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, page: 1, pageCount: 1 });
    expect(ids(res.body.items)).toEqual(['TX-4', 'TX-2', 'TX-3', 'TX-1']);
    const tx3 = res.body.items.find((t: { id: string }) => t.id === 'TX-3');
    expect(tx3).toMatchObject({
      amount: 15400,
      timestamp: '2026-09-02T02:34:00',
      location: { city: 'Lagos', country: 'Nigeria' },
      riskScore: 80,
      riskLevel: 'critical',
      status: 'declined',
      senderMsisdn: '024****601',
      reviewStatus: 'new',
      latestDecision: null,
    });
    // Reasons keep their order; a rule the engine no longer knows is left out.
    expect(tx3.fraudReasons).toEqual([
      { ruleId: 'amount', points: 25, text: 'Amount is 18x the average' },
      { ruleId: 'country', points: 20, text: 'First transaction in Nigeria' },
    ]);
  });

  it.each([
    ['risk=critical', ['TX-3']],
    ['status=pending', ['TX-4']],
    ['flagged=1', ['TX-4', 'TX-2', 'TX-3']],
    ['country=Nigeria', ['TX-3']],
    ['min=1000', ['TX-2', 'TX-3']],
    ['from=2026-09-02', ['TX-4', 'TX-2', 'TX-3']],
    ['q=ama', ['TX-4']],
    ['q=shop', ['TX-4']],
    ['q=lagos', ['TX-3']],
    ['q=tx-1', ['TX-1']],
    ['risk=low&q=john', ['TX-1']],
  ])('filters by %s', async (query, expected) => {
    await seed();
    const res = await get(`/api/transactions?${query}`, await analystCookie());
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(expected);
    expect(res.body.total).toBe(expected.length);
  });

  it('sorts by score or amount, either way', async () => {
    await seed();
    const cookie = await analystCookie();
    const byScore = await get('/api/transactions?sort=score&dir=desc', cookie);
    expect(ids(byScore.body.items)).toEqual(['TX-3', 'TX-4', 'TX-2', 'TX-1']);
    const byAmount = await get('/api/transactions?sort=amount&dir=asc', cookie);
    expect(ids(byAmount.body.items)).toEqual(['TX-4', 'TX-1', 'TX-2', 'TX-3']);
  });

  it('pages, and clamps a page past the end to the last one', async () => {
    await seed();
    const cookie = await analystCookie();
    const second = await get('/api/transactions?pageSize=3&page=2', cookie);
    expect(second.body).toMatchObject({ total: 4, page: 2, pageCount: 2 });
    expect(ids(second.body.items)).toEqual(['TX-1']);
    const past = await get('/api/transactions?pageSize=3&page=9', cookie);
    expect(past.body.page).toBe(2);
  });

  it('rejects invalid filters with the field named', async () => {
    const res = await get('/api/transactions?risk=extreme&from=05-10-2026', await analystCookie());
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'from',
      'risk',
    ]);
  });
});

describe('GET /api/dashboard', () => {
  it('summarises everything stored and lists the queue riskiest first', async () => {
    await seed();
    const res = await get('/api/dashboard', await analystCookie());

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total: 4,
      flagged: 3,
      declined: 1,
      pending: 1,
      totalAmount: 17850,
      flaggedAmount: 17000,
    });
    expect(res.body.byLevel).toEqual([
      { level: 'low', count: 1 },
      { level: 'medium', count: 1 },
      { level: 'high', count: 1 },
      { level: 'critical', count: 1 },
    ]);
    expect(res.body.daily).toEqual([
      { date: '2026-09-01', total: 1, flagged: 0 },
      { date: '2026-09-02', total: 2, flagged: 2 },
      { date: '2026-09-03', total: 1, flagged: 1 },
    ]);
    expect(res.body.needsReview).toBe(3);
    expect(ids(res.body.queue)).toEqual(['TX-3', 'TX-4', 'TX-2']);
    expect(res.body.countries).toEqual(['Ghana', 'Nigeria']);
  });

  it('works with nothing stored', async () => {
    const res = await get('/api/dashboard', await analystCookie());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ needsReview: 0, queue: [], daily: [], countries: [] });
    expect(res.body.summary).toMatchObject({ total: 0, totalAmount: 0 });
  });
});

describe('GET /api/transactions/:id and /api/customers/:accountId', () => {
  it('returns one transaction with an empty history', async () => {
    await seed();
    const res = await get('/api/transactions/TX-3', await analystCookie());
    expect(res.status).toBe(200);
    expect(res.body.transaction).toMatchObject({ id: 'TX-3', riskScore: 80 });
    expect(res.body.decisions).toEqual([]);
  });

  it('answers 404 for an unknown transaction or customer', async () => {
    const cookie = await analystCookie();
    expect((await get('/api/transactions/TX-404', cookie)).status).toBe(404);
    expect((await get('/api/customers/ACC-404', cookie)).status).toBe(404);
  });

  it("returns a customer's transactions oldest first", async () => {
    await seed();
    const res = await get('/api/customers/ACC-1', await analystCookie());
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('ACC-1');
    expect(ids(res.body.transactions)).toEqual(['TX-1', 'TX-3', 'TX-2']);
  });
});

describe('GET /api/rules', () => {
  it('lists the stored rules in engine order, with only their settings', async () => {
    await prisma.rule.createMany({
      data: [...DEFAULT_RULES].reverse().map(({ id, name, condition, points, enabled }) => ({
        id,
        name,
        condition,
        points,
        enabled,
      })),
    });
    const res = await get('/api/rules', await analystCookie());
    expect(res.status).toBe(200);
    expect(res.body.rules.map((r: { id: string }) => r.id)).toEqual(DEFAULT_RULES.map((r) => r.id));
    expect(Object.keys(res.body.rules[0]).sort()).toEqual([
      'condition',
      'enabled',
      'id',
      'name',
      'points',
    ]);
  });
});

describe('POST /api/transactions/:id/decisions', () => {
  it('records a verdict, resolves the review and audits it', async () => {
    await seed();
    const analyst = await createUser('analyst');
    const cookie = await login(analyst.email);

    const res = await decide('TX-3', cookie, {
      decision: 'confirmed_fraud',
      notes: '  Customer confirmed the card was stolen.  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.reviewStatus).toBe('resolved');
    expect(res.body.decision).toMatchObject({
      decision: 'confirmed_fraud',
      notes: 'Customer confirmed the card was stolen.',
      analyst: { id: analyst.id, name: 'Test analyst' },
    });
    const entry = await prisma.auditLog.findFirst({ where: { action: 'decision' } });
    expect(entry).toMatchObject({
      actorId: analyst.id,
      entity: 'transaction',
      entityId: 'TX-3',
      detail: { decision: 'confirmed_fraud', from: 'new', to: 'resolved' },
    });

    // Resolved transactions leave the queue.
    const dashboard = await get('/api/dashboard', cookie);
    expect(dashboard.body.needsReview).toBe(2);
    expect(ids(dashboard.body.queue)).toEqual(['TX-4', 'TX-2']);
  });

  it('keeps a review open when more information is needed', async () => {
    await seed();
    const cookie = await analystCookie();
    const res = await decide('TX-4', cookie, {
      decision: 'needs_info',
      notes: 'Calling the customer.',
    });
    expect(res.body.reviewStatus).toBe('under_review');
    const queued = await get('/api/transactions?needsReview=1', cookie);
    expect(ids(queued.body.items)).toContain('TX-4');
    const underReview = await get('/api/transactions?review=under_review', cookie);
    expect(ids(underReview.body.items)).toEqual(['TX-4']);
  });

  it('never overwrites: a change of mind is a new decision and the latest one counts', async () => {
    await seed();
    await createUser('admin');
    const analyst = await analystCookie();
    const admin = await login('admin@example.com');

    await decide('TX-3', analyst, { decision: 'needs_info', notes: 'Checking with the bank.' });
    await decide('TX-3', analyst, { decision: 'confirmed_fraud', notes: 'Bank says fraud.' });
    await decide('TX-3', admin, { decision: 'false_positive', notes: 'Customer was travelling.' });

    const res = await get('/api/transactions/TX-3', analyst);
    expect(res.body.transaction.reviewStatus).toBe('resolved');
    expect(res.body.transaction.latestDecision).toMatchObject({ decision: 'false_positive' });
    expect(
      res.body.decisions.map(
        (d: { decision: string; notes: string; analyst: { name: string } }) => [
          d.decision,
          d.notes,
          d.analyst.name,
        ],
      ),
    ).toEqual([
      ['false_positive', 'Customer was travelling.', 'Test admin'],
      ['confirmed_fraud', 'Bank says fraud.', 'Test analyst'],
      ['needs_info', 'Checking with the bank.', 'Test analyst'],
    ]);
    expect(await prisma.analystDecision.count()).toBe(3);
  });

  it.each([
    ['a blank note', { decision: 'confirmed_fraud', notes: '   ' }, 'notes'],
    ['a missing note', { decision: 'confirmed_fraud' }, 'notes'],
    ['an unknown decision', { decision: 'maybe', notes: 'Not sure' }, 'decision'],
    [
      'a note over 2000 characters',
      { decision: 'false_positive', notes: 'x'.repeat(2001) },
      'notes',
    ],
  ])('rejects %s', async (_label, body, field) => {
    await seed();
    const res = await decide('TX-3', await analystCookie(), body);
    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ field }));
    expect(await prisma.analystDecision.count()).toBe(0);
  });

  it('answers 404 for an unknown transaction and stores nothing', async () => {
    const res = await decide('TX-404', await analystCookie(), {
      decision: 'confirmed_fraud',
      notes: 'Stolen card.',
    });
    expect(res.status).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: 'decision' } })).toBe(0);
  });
});
