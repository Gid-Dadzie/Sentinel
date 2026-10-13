import { createApp } from './app';
import { loadConfig } from './config';
import { createPrisma } from './db';

/**
 * The API as a Vercel serverless function (see api/index.js and vercel.json). Vercel calls
 * the exported app for every /api request; the database client is created once per
 * warm instance and reused.
 */
// Prefer the direct connection when Vercel's Neon integration provides one: this app's
// traffic is small, and it avoids connection-pooler quirks with Prisma.
const config = loadConfig({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = createPrisma(config.DATABASE_URL);

export default createApp({ prisma, secureCookies: config.NODE_ENV === 'production' });
