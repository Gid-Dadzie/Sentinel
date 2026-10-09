import type { PrismaClient, Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { HttpError } from '../http';
import { findSessionUser, readSessionToken, type SessionUser } from './sessions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** Set by requireAuth for every request it lets through. */
      user: SessionUser;
    }
  }
}

/** Rejects the request with 401 unless it carries a live session. */
export function requireAuth(prisma: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const token = readSessionToken(req);
    const user = token ? await findSessionUser(prisma, token) : null;
    if (!user) throw new HttpError(401, 'Sign in to continue');
    res.locals.user = user;
    next();
  };
}

/** Use after requireAuth. Rejects with 403 when the user's role is not allowed. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(res.locals.user.role)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }
    next();
  };
}
