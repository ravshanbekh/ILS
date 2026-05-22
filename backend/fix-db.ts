import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  // Update all entries from May 21st to May 22nd if they were done on May 22nd local time
  const updated = await prisma.dailyChecklistEntry.updateMany({
    where: {
      date: new Date('2026-05-21T00:00:00.000Z'),
      doneAt: {
        gte: new Date('2026-05-21T19:00:00.000Z') // Local May 22nd midnight
      }
    },
    data: {
      date: new Date('2026-05-22T00:00:00.000Z')
    }
  });

  console.log(`Updated ${updated.count} entries!`);
  await prisma.$disconnect();
}

fix().catch(e => {
  console.error(e);
  process.exit(1);
});
