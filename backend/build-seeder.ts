import fs from 'fs';

const data = fs.readFileSync('checklists_export.json', 'utf8');

const seedScript = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const checklists = ${data};

async function main() {
  console.log('Starting seed...');
  let added = 0;
  for (const item of checklists) {
    const exists = await prisma.checklistItem.findFirst({
      where: {
        role: item.role,
        order: item.order,
        category: item.category,
        description: item.description
      }
    });

    if (!exists) {
      await prisma.checklistItem.create({
        data: {
          role: item.role,
          order: item.order,
          score: item.score,
          section: item.section,
          category: item.category,
          description: item.description,
          isActive: item.isActive
        }
      });
      added++;
    }
  }
  console.log(\`Seed finished. Added \${added} new items.\`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;

fs.writeFileSync('prisma/seed-new-checklists.ts', seedScript);
console.log('Created seed script!');
