import { createHash } from 'node:crypto';
import request from 'supertest';
import { SESSION_COOKIE } from '../auth/sessions';
import {
  PASSWORD,
  app,
  createUser,
  login,
  prisma,
  resetDatabase,
  sessionCookie,
} from '../test/helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/login', () => {
  it('signs in with a locked-down cookie and returns the user without the hash', async () => {
    const admin = await createUser('admin');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ADMIN@example.com ', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: admin.id, name: 'Test admin', email: 'admin@example.com', role: 'admin' },
    });
    const cookie = sessionCookie(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);
    expect(await prisma.auditLog.count({ where: { action: 'login', actorId: admin.id } })).toBe(1);
  });

  it('stores only a hash of the session token', async () => {
    await createUser('analyst');
    const cookie = await login('analyst@example.com');
    const token = decodeURIComponent(cookie.slice(`${SESSION_COOKIE}=`.length));
    const [session] = await prisma.session.findMany();
    expect(session?.id).toBe(createHash('sha256').update(token).digest('hex'));
    expect(session?.id).not.toBe(token);
  });

  it('gives the same answer for a wrong password and an unknown email, and audits both', async () => {
    const user = await createUser('analyst');
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'not the password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Email or password is incorrect');
      expect(sessionCookie(res.headers['set-cookie'])).toBeUndefined();
    }
    const failures = await prisma.auditLog.findMany({ where: { action: 'login.failed' } });
    expect(failures.map((f) => f.detail)).toEqual([
      { email: user.email },
      { email: 'nobody@example.com' },
    ]);
  });

  it('rejects a malformed body with field-level details', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(['email', 'password']);
  });
});

describe('sessions', () => {
  it('lets a signed-in user see who they are', async () => {
    await createUser('analyst');
    const cookie = await login('analyst@example.com');
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'analyst@example.com', role: 'analyst' });
  });

  it('rejects requests without a session or with a made-up one', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=abc`);
    expect(forged.status).toBe(401);
  });

  it('ends the session on logout, so the old cookie stops working', async () => {
    const user = await createUser('analyst');
    const cookie = await login(user.email);

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(sessionCookie(res.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await prisma.session.count()).toBe(0);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { action: 'logout', actorId: user.id } })).toBe(1);
  });

  it('rejects and removes an expired session', async () => {
    await createUser('analyst');
    const cookie = await login('analyst@example.com');
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });
});
