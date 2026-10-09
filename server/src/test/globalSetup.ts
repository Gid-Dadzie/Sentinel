import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testDatabaseUrl } from './database';

/**
 * Brings the test database up to the latest schema. `migrate deploy` only applies
 * missing migrations and never drops data; each test empties the tables it uses.
 */
export default function setup() {
  const serverDir = fileURLToPath(new URL('../..', import.meta.url));
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}
