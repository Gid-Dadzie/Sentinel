import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

/**
 * The database API tests run against: TEST_DATABASE_URL, or else DATABASE_URL with
 * "_test" added to the database name. Refuses any name not ending in "_test", so the
 * tests (which wipe tables) can never touch real data.
 */
export function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL && existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  const explicit = process.env.TEST_DATABASE_URL;
  const source = explicit ?? process.env.DATABASE_URL;
  if (!source) {
    throw new Error(
      'Set DATABASE_URL or TEST_DATABASE_URL (see server/.env.example) to run API tests.',
    );
  }

  const url = new URL(source);
  if (!explicit) url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${name}": the database name must end in _test.`,
    );
  }
  return url.toString();
}
