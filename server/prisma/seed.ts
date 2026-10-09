/**
 * Seeds the default rules and the first admin account. Safe to run again:
 * rules an admin has already edited are left alone, and an existing admin is not changed.
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RULES } from '@sentinel/engine';
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
  console.error(`Cannot seed (see server/.env.example):\n${problems}`);
  process.exit(1);
}

const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = env.data;
const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.rule.createMany({
    data: DEFAULT_RULES.map(({ id, name, condition, points, enabled }) => ({
      id,
      name,
      condition,
      points,
      enabled,
    })),
    skipDuplicates: true,
  });

  const email = SEED_ADMIN_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: SEED_ADMIN_NAME,
        email,
        role: 'admin',
        passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
      },
    });
  }

  console.log(
    `Seeded ${rules.count} new rule(s); admin ${email} ${existing ? 'already existed' : 'created'}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
