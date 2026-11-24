import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting deduplication of submissions...');
  
  // Find all submissions.
  // MUHIM: faqat kerakli ustunlar. Bu skript konteyner ishga tushganda `prisma db push`
  // dan OLDIN ishlaydi — select'siz so'rov sxemadagi YANGI ustunni ham so'raydi, u esa
  // bazada hali yo'q → "column does not exist" → konteyner cheksiz qayta yiqiladi
  // (2026-11-24: Submission.firstSubmittedAt qo'shilganda prod 502 bo'ldi).
  const allSubmissions = await prisma.submission.findMany({
    select: { id: true, studentId: true, normativeId: true },
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
