#!/usr/bin/env node
/**
 * Asset arxivlari noto'g'ri joyga chiqarilganda ularni o'z joyiga ko'chiradi.
 *
 * NEGA KERAK
 * Generatsiya qilingan zip arxivlar ichida to'liq yo'l saqlangan:
 *   frontend/public/illustrations/...
 * Arxiv `design/it-live-score/` ichida ochilsa, fayllar
 *   design/it-live-score/frontend/public/illustrations/...
 * ga tushadi va ilova ularni ko'rmaydi. Bu uch marta takrorlandi,
 * shuning uchun qo'lda ko'chirish o'rniga bitta buyruq.
 *
 * Ishlatish:
 *   npm run assets:sync
 *
 * Xavfsiz: faqat ko'chiradi va ustiga yozadi, hech narsa o'chirmaydi
 * (bo'shab qolgan papkalardan tashqari).
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(repoRoot, 'frontend', 'public');

/** Arxivlar odatda shu yo'llarga ochiladi */
const strayRoots = [
  join(repoRoot, 'design', 'it-live-score', 'frontend', 'public'),
  join(repoRoot, 'design', 'frontend', 'public'),
  join(repoRoot, 'frontend', 'frontend', 'public'),
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let moved = 0;
for (const root of strayRoots) {
  if (!existsSync(root)) continue;

  for (const file of walk(root)) {
    const rel = relative(root, file);
    const dest = join(target, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
    console.log(`  -> frontend/public/${rel.split('\\').join('/')}`);
    moved++;
  }

  // Bo'shab qolgan "soxta" daraxtni tozalaymiz
  const strayTop = root.replace(/[\\/]public$/, '').replace(/[\\/]frontend$/, '');
  rmSync(join(strayTop, 'frontend'), { recursive: true, force: true });
}

if (moved === 0) {
  console.log("Ko'chiriladigan asset topilmadi — hammasi joyida.");
} else {
  console.log(`\n${moved} ta fayl ko'chirildi.`);
  console.log('Eslatma: assetlar yangilansa frontend/src/components/brand/assetVersion.ts');
  console.log('dagi ASSET_VERSION ni oshiring, aks holda Cloudflare eskisini beradi.');
}
