import prisma from './src/lib/prisma';
async function main() {
  const ledgers = await prisma.ledger.findMany({ where: { userId: '9001' } });
  const nanLedgers = ledgers.filter(l => l.change.startsWith('--'));
  console.log(`Found ${nanLedgers.length} NaN ledgers.`);
  
  for (const ledger of nanLedgers) {
      await prisma.ledger.update({
          where: { id: ledger.id },
          data: {
              change: ledger.change.substring(1) // remove one '-'
          }
      });
  }
  console.log('Fixed NaN ledgers.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
