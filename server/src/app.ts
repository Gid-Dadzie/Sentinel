import express, { type ErrorRequestHandler, type Express } from 'express';

/** What the app needs from the outside world; tests pass fakes. */
export interface AppDeps {
  /** Resolves when the database answers, rejects otherwise. */
  checkDatabase: () => Promise<void>;
}

export function createApp({ checkDatabase }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Never leak stack traces or internals to the client.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return app;
}
