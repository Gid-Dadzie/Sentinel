import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config';

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const app = createApp({ checkDatabase: () => Promise.resolve() });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('reports 503 without details when the database is down', async () => {
    const app = createApp({
      checkDatabase: () => Promise.reject(new Error('password authentication failed')),
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'unreachable' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('unknown routes', () => {
  it('answer JSON 404 and do not advertise Express', async () => {
    const app = createApp({ checkDatabase: () => Promise.resolve() });
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.headers['x-powered-by']).toBeUndefined();
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
