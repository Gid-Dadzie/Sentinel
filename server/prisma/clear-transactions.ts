/**
 * Removes every stored transaction, with its reasons and analyst decisions, so a fresh
 * file can be imported. Users, rules and the audit log are kept, and the clearing itself
 * is recorded in the audit log. Admins can do the same from the Import page. Run on the
 * server only:
 *   npm run db:clear-transactions -w @sentinel/server -- --yes
 */
import { PrismaClient } from '@prisma/client';
import { clearTransactions } from '../src/transactions/clear';

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--yes')) {
    const [transactions, decisions] = await Promise.all([
      prisma.transaction.count(),
      prisma.analystDecision.count(),
    ]);
    console.log(
      `This would delete ${transactions} transaction(s) and ${decisions} analyst decision(s).\n` +
        'Users, rules and the audit log are kept. To go ahead, run it again with --yes:\n' +
        '  npm run db:clear-transactions -w @sentinel/server -- --yes',
    );
    return;
  }
  const { transactions, decisions } = await clearTransactions(prisma, null);
  console.log(
    `Deleted ${transactions} transaction(s) and ${decisions} decision(s). Import a new file from the Import page.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
