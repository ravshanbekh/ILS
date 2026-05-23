import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  const items = await prisma.checklistItem.findMany();
  fs.writeFileSync('checklists_export.json', JSON.stringify(items, null, 2));
  console.log(`Exported ${items.length} items`);
  await prisma.$disconnect();
}
run();
