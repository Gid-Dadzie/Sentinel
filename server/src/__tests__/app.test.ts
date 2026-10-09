import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { prisma } from '../test/helpers';

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const res = await request(createApp({ prisma, secureCookies: false })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('reports 503 without details when the database is down', async () => {
    const app = createApp({
      prisma,
      secureCookies: false,
      checkDatabase: () => Promise.reject(new Error('password authentication failed')),
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'unreachable' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('request handling', () => {
  const app = createApp({ prisma, secureCookies: false });

  it('hides routes from anyone not signed in and does not advertise Express', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Sign in to continue' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers malformed JSON with a 400, not a crash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body is not valid JSON' });
  });
});

describe('loadConfig', () => {
  const DATABASE_URL = 'postgresql://user:pw@localhost:5432/sentinel';

  it('applies defaults', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL,
      PORT: 4000,
    });
  });

  it('lists every problem at once', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x', PORT: 'abc' })).toThrow(
      /DATABASE_URL: must be a postgresql:\/\/ URL[\s\S]*PORT/,
    );
  });
});
