import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting deduplication of submissions...');
  
  // Find all submissions
  const allSubmissions = await prisma.submission.findMany({
    orderBy: [
      { score: 'desc' }, // Keep highest score first
      { submittedAt: 'desc' }, // Then most recent
    ]
  });

  const seen = new Set<string>();
  let duplicatesCount = 0;
  
  for (const sub of allSubmissions) {
    const key = `${sub.studentId}_${sub.normativeId}`;
    if (seen.has(key)) {
      // It's a duplicate, delete it
      await prisma.submission.delete({ where: { id: sub.id } });
      duplicatesCount++;
    } else {
      seen.add(key);
    }
  }
  
  console.log(`Deduplication finished. Deleted ${duplicatesCount} duplicate submissions.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
