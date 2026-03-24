import prisma from './src/lib/prisma';
async function main() {
  const ledgers = await prisma.ledger.findMany({ where: { userId: '9001' } });
  const nanLedgers = ledgers.filter(l => isNaN(Number(l.change)));
  console.log("NaN LEDGERS:", nanLedgers);
}
main().catch(console.error).finally(() => prisma.$disconnect());
