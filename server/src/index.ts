import { createApp } from './app';
import { loadConfig } from './config';
import { createPrisma, pingDatabase } from './db';

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const app = createApp({ checkDatabase: () => pingDatabase(prisma) });

const server = app.listen(config.PORT, () => {
  console.log(`Sentinel API listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
