import prisma from '../../config/database';

/**
 * O'qituvchi qaysi darslik papkalarini ko'ra oladi.
 *
 * Ilgari bu mantiq faqat lessons.controller ichida edi. Endi uyga vazifa
 * tanlash ham shunga tayanadi: o'qituvchiga dostup berilmagan kursning
 * vazifalari ro'yxatda umuman chiqmaydi.
 *
 *  - inherited  — ruxsat berilgan papka VA uning butun ichki daraxti.
 *                 Darsliklar (va ularning vazifalari) shu papkalarda ochiq.
 *  - passthrough — o'sha daraxtga yetib borish uchun kerak bo'lgan ajdodlar.
 *                 Faqat navigatsiya uchun ko'rinadi, ichidagi darslik ochilmaydi.
 */
export async function getTeacherVisibility(teacherId: string) {
  const [allFolders, accessRows] = await Promise.all([
    prisma.lessonFolder.findMany({ select: { id: true, parentId: true } }),
    prisma.lessonFolderAccess.findMany({ where: { teacherId }, select: { folderId: true } }),
  ]);

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string | null>();
  for (const f of allFolders) {
    parentMap.set(f.id, f.parentId);
    if (f.parentId) {
      if (!childrenMap.has(f.parentId)) childrenMap.set(f.parentId, []);
      childrenMap.get(f.parentId)!.push(f.id);
    }
  }

  const inherited = new Set<string>();
  const passthrough = new Set<string>();

  for (const { folderId } of accessRows) {
    const queue = [folderId];
    while (queue.length) {
      const cur = queue.shift()!;
      if (inherited.has(cur)) continue;
      inherited.add(cur);
      for (const child of childrenMap.get(cur) || []) queue.push(child);
    }

    let p = parentMap.get(folderId) ?? null;
    while (p) {
      if (passthrough.has(p) || inherited.has(p)) break;
      passthrough.add(p);
      p = parentMap.get(p) ?? null;
    }
  }

  return { inherited, visible: new Set<string>([...inherited, ...passthrough]), parentMap };
}

/**
 * Papkaning eng yuqoridagi ajdodini (kursini) topadi.
 * Masalan "Foundation > 1-modul > 3-dars" -> "Foundation".
 * Vazifalarni kurs bo'yicha kategoriyalash uchun kerak.
 */
export function rootFolderOf(folderId: string, parentMap: Map<string, string | null>): string {
  let cur = folderId;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(cur)) return cur; // aylanma bo'lsa (bo'lmasligi kerak) — to'xtaymiz
    seen.add(cur);
    const parent = parentMap.get(cur);
    if (!parent) return cur;
    cur = parent;
  }
}
