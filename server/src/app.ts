import type { PrismaClient } from '@prisma/client';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { requireAuth } from './auth/middleware';
import { HttpError } from './http';
import { authRouter } from './routes/auth';
import { importsRouter } from './routes/imports';
import { usersRouter } from './routes/users';

/**
 * What someone sees opening the API's address in a browser. The app itself is the web
 * front end; this server only answers /api requests.
 */
const ROOT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sentinel API</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem;
         background: Canvas; color: CanvasText; }
  main { max-width: 34rem; line-height: 1.55; }
  h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
  code { white-space: nowrap; padding: .1rem .35rem; border-radius: .3rem; background: color-mix(in srgb, CanvasText 10%, transparent); }
  a { color: LinkText; }
</style>
</head>
<body>
<main>
  <h1>The Sentinel API is running</h1>
  <p>This address is the API only; there is nothing to sign in to here.</p>
  <p>To use Sentinel, start the web app in a second terminal with <code>npm run dev:api</code>,
     then open <a href="http://localhost:5173/">http://localhost:5173</a>.</p>
  <p>Health check: <a href="/api/health">/api/health</a></p>
</main>
</body>
</html>`;

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
  app.get('/', (_req, res) => {
    res.type('html').send(ROOT_PAGE);
  });
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
  app.use('/api/imports', importsRouter(prisma));

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
    // Oversized bodies (the JSON limit, or the 10 MB upload limit).
    if (err instanceof Error && 'type' in err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'The file is too large; the limit is 10 MB' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return app;
}
