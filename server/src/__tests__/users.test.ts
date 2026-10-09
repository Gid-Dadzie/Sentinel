import request from 'supertest';
import { app, createUser, login, prisma, resetDatabase } from '../test/helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const newAnalyst = {
  name: 'Ama Owusu',
  email: 'Ama@Example.com',
  password: 'a long enough password',
};

describe('/api/users (admin only)', () => {
  it('turns away analysts with 403 and anonymous users with 401', async () => {
    await createUser('analyst');
    const cookie = await login('analyst@example.com');

    expect((await request(app).get('/api/users').set('Cookie', cookie)).status).toBe(403);
    const create = await request(app).post('/api/users').set('Cookie', cookie).send(newAnalyst);
    expect(create.status).toBe(403);
    expect(create.body.error).toBe('You do not have permission to do this');
    expect((await request(app).get('/api/users')).status).toBe(401);
    expect(await prisma.user.count()).toBe(1);
  });

  it('lets an admin create an analyst who can then sign in', async () => {
    const admin = await createUser('admin');
    const cookie = await login(admin.email);

    const res = await request(app).post('/api/users').set('Cookie', cookie).send(newAnalyst);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Ama Owusu',
      email: 'ama@example.com',
      role: 'analyst',
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    await expect(login('ama@example.com', newAnalyst.password)).resolves.toMatch(
      /^sentinel_session=/,
    );
    const entry = await prisma.auditLog.findFirst({ where: { action: 'user.create' } });
    expect(entry).toMatchObject({ actorId: admin.id, entityId: res.body.user.id });
  });

  it('lists users without password hashes', async () => {
    const admin = await createUser('admin');
    await createUser('analyst');
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', await login(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { role: string }) => u.role)).toEqual(['admin', 'analyst']);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects short passwords and duplicate emails', async () => {
    const admin = await createUser('admin');
    const cookie = await login(admin.email);

    const short = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ ...newAnalyst, password: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.details).toEqual([
      { field: 'password', message: 'must be at least 12 characters' },
    ]);

    const duplicate = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ ...newAnalyst, email: 'ADMIN@example.com' });
    expect(duplicate.status).toBe(409);
  });
});
