import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient, Role } from '@prisma/client';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'sentinel_session';
export const SESSION_HOURS = 8;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Starts a session and returns the token for the cookie. Only its hash is stored. */
export async function createSession(
  prisma: PrismaClient,
  userId: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** The signed-in user for a token, or null when it is unknown or expired. */
export async function findSessionUser(
  prisma: PrismaClient,
  token: string,
  now = new Date(),
): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

export async function deleteSession(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Reads one cookie from the request header (no parser dependency needed for one cookie). */
export function readSessionToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** HttpOnly: page scripts cannot read it. SameSite=Strict: other sites cannot send it. */
export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/api',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure, path: '/api' });
}
