/**
 * Sets the admin's password to SEED_ADMIN_PASSWORD from server/.env, for when it has been
 * forgotten. Creates the admin if that email has no account yet. Signs the account out
 * everywhere and records the reset in the audit log. Run on the server only:
 *   npm run db:set-password -w @sentinel/server
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const env = z
  .object({
    SEED_ADMIN_NAME: z.string().min(1).default('Sentinel Admin'),
    SEED_ADMIN_EMAIL: z.string().email(),
    SEED_ADMIN_PASSWORD: z.string().min(12, 'must be at least 12 characters'),
  })
  .safeParse(process.env);

if (!env.success) {
  const problems = env.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Cannot set the password (fill these in server/.env and save it):\n${problems}`);
  process.exit(1);
}

const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = env.data;
const prisma = new PrismaClient();

async function main() {
  const email = SEED_ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { name: SEED_ADMIN_NAME, email, role: 'admin', passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.create({
    data: { actorId: null, action: 'user.password_reset', entity: 'user', entityId: user.id },
  });
  console.log(
    `Password for ${email} (${user.role}) now matches SEED_ADMIN_PASSWORD in server/.env. Sign in with it.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
