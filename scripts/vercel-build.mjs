// Vercel's build: generate the database client, bring the hosted database's tables up to
// date, add the default rules and the first admin (safe to repeat), then build the API
// bundle and the web app in API mode. Run by `npm run vercel-build` (see vercel.json).
import { execSync } from 'node:child_process';

// Migrations need a direct connection. Vercel's Neon integration provides one as
// DATABASE_URL_UNPOOLED next to the pooled DATABASE_URL; a single pasted URL works too.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    'Set DATABASE_URL in the Vercel project settings (see README, "Deploying to Vercel").',
  );
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: databaseUrl };
const run = (command) => execSync(command, { stdio: 'inherit', env });

run('npm run db:generate -w @sentinel/server');
run('npm run db:deploy -w @sentinel/server');
run('npm run db:seed -w @sentinel/server');
run('npm run build -w @sentinel/server');
run('npm run build:api');
