import { PrismaClient, type Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../app';
import { hashPassword } from '../auth/password';
import { SESSION_COOKIE } from '../auth/sessions';
import { testDatabaseUrl } from './database';

export const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl() });
export const app = createApp({ prisma, secureCookies: false });

/** Empties every table between tests. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE sessions, audit_log, decisions, fraud_reasons, transactions, rules, users RESTART IDENTITY CASCADE',
  );
}

export const PASSWORD = 'correct horse battery';

export async function createUser(role: Role, email = `${role}@example.com`) {
  return prisma.user.create({
    data: { name: `Test ${role}`, email, role, passwordHash: await hashPassword(PASSWORD) },
  });
}

/** Logs in and returns the "name=value" cookie to send with later requests. */
export async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  const cookie = sessionCookie(res.headers['set-cookie']);
  if (!cookie) throw new Error('login set no session cookie');
  return cookie.split(';')[0] ?? '';
}

/** The full Set-Cookie line for the session cookie, if any. */
export function sessionCookie(header: string | string[] | undefined): string | undefined {
  const lines = Array.isArray(header) ? header : header ? [header] : [];
  return lines.find((line) => line.startsWith(`${SESSION_COOKIE}=`));
}
