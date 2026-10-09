import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireAuth } from '../auth/middleware';
import { verifyPassword } from '../auth/password';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionToken,
  setSessionCookie,
} from '../auth/sessions';
import { HttpError, parseBody } from '../http';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export function authRouter(prisma: PrismaClient, secureCookies: boolean): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { email, password } = parseBody(req, loginSchema);
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash);

    if (!user || !ok) {
      await audit(prisma, {
        actorId: user?.id ?? null,
        action: 'login.failed',
        entity: 'user',
        detail: { email },
      });
      // One message for both cases, so the response does not reveal which emails exist.
      throw new HttpError(401, 'Email or password is incorrect');
    }

    const { token, expiresAt } = await createSession(prisma, user.id);
    setSessionCookie(res, token, expiresAt, secureCookies);
    await audit(prisma, { actorId: user.id, action: 'login', entity: 'user', entityId: user.id });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  router.post('/logout', requireAuth(prisma), async (req, res) => {
    const token = readSessionToken(req);
    if (token) await deleteSession(prisma, token);
    clearSessionCookie(res, secureCookies);
    const { user } = res.locals;
    await audit(prisma, { actorId: user.id, action: 'logout', entity: 'user', entityId: user.id });
    res.status(204).end();
  });

  router.get('/me', requireAuth(prisma), (_req, res) => {
    res.json({ user: res.locals.user });
  });

  return router;
}
