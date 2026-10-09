import type { PrismaClient } from '@prisma/client';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { requireAuth } from './auth/middleware';
import { HttpError } from './http';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';

export interface AppDeps {
  prisma: PrismaClient;
  /** Send cookies over HTTPS only. On in production. */
  secureCookies: boolean;
  /** Resolves when the database answers; tests can replace it. */
  checkDatabase?: () => Promise<void>;
}

export function createApp({ prisma, secureCookies, checkDatabase }: AppDeps): Express {
  const pingDatabase = checkDatabase ?? (() => prisma.$queryRaw`SELECT 1`.then(() => undefined));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Public routes.
  app.get('/api/health', async (_req, res) => {
    try {
      await pingDatabase();
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });
  app.use('/api/auth', authRouter(prisma, secureCookies));

  // Everything below needs a signed-in user; routers add role checks where needed.
  app.use('/api', requireAuth(prisma));
  app.use('/api/users', usersRouter(prisma));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Known errors carry a safe message; anything else is logged and hidden from the client.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    // Malformed JSON bodies come from express.json() as 400s.
    if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
      res.status(400).json({ error: 'Request body is not valid JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return app;
}
