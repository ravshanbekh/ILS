import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';

// ─── Papkalar ──────────────────────────────────────────────────────────────────

/** O'qituvchi uchun papka ko'rinishini hisoblaydi (ichma-ich papkalarni hisobga olib):
 *  - inherited: ruxsat berilgan papka + uning BUTUN ichki daraxti → to'liq kirish (darsliklar ko'rinadi)
 *  - passthrough: shu daraxtga borish uchun kerak bo'lgan ajdod papkalar → faqat navigatsiya
 *    uchun ko'rinadi, ichidagi darsliklar ko'rinmaydi (agar alohida ruxsat berilmagan bo'lsa)
 */
async function getTeacherVisibility(teacherId: string) {
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

  return { inherited, visible: new Set<string>([...inherited, ...passthrough]) };
}

/** GET /api/lessons/folders?parentId=xxx
 *  admin → shu daraja papkalari + item/bo'lim soni
 *  teacher → faqat ruxsat berilganlar (yoki ularga borish uchun kerakli ajdodlar)
 */
export const getFolders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const isAdmin = ['admin', 'administrator', 'filial_rahbari'].includes(user.role);
    const parentId = (req.query.parentId as string) || null;

    let folders;
    if (isAdmin) {
      folders = await prisma.lessonFolder.findMany({
        where: { parentId },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { items: true, access: true, children: true } },
        },
      });
    } else {
      const { visible } = await getTeacherVisibility(user.userId);
      const candidates = await prisma.lessonFolder.findMany({
        where: { parentId },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { items: true, children: true } },
        },
      });
      folders = candidates.filter(f => visible.has(f.id));
    }

    res.json({ data: folders });
  } catch (e) { next(e); }
};

/** POST /api/lessons/folders */
export const createFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, icon, order, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Papka nomi kiritilishi shart' });

    if (parentId) {
      const parent = await prisma.lessonFolder.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(404).json({ error: "Ota papka topilmadi" });
    }

    const folder = await prisma.lessonFolder.create({
      data: {
        name,
        description: description || null,
        icon: icon || '📁',
        order: order ?? 0,
        parentId: parentId || null,
        createdById: req.user!.userId,
      },
      include: { _count: { select: { items: true, access: true, children: true } } },
    });

    res.status(201).json({ data: folder });
  } catch (e) { next(e); }
};

/** PATCH /api/lessons/folders/:id */
export const updateFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, icon, order } = req.body;

    const folder = await prisma.lessonFolder.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
      },
      include: { _count: { select: { items: true, access: true, children: true } } },
    });

    res.json({ data: folder });
  } catch (e) { next(e); }
};

/** DELETE /api/lessons/folders/:id */
export const deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // Cascade: ichki papkalar, ularning darsliklari va ruxsatlari ham o'chadi
    await prisma.lessonFolder.delete({ where: { id } });
    res.json({ message: "Papka o'chirildi" });
  } catch (e) { next(e); }
};

/** GET /api/lessons/folders/tree — barcha papkalar yassi ro'yxati (admin, ko'chirish uchun) */
export const getFolderTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folders = await prisma.lessonFolder.findMany({
      select: { id: true, name: true, icon: true, parentId: true },
      orderBy: { order: 'asc' },
    });
    res.json({ data: folders });
  } catch (e) { next(e); }
};

// ─── Darsliklar ────────────────────────────────────────────────────────────────

/** GET /api/lessons/folders/:id/items */
export const getItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = ['admin', 'administrator', 'filial_rahbari'].includes(user.role);

    if (!isAdmin) {
      // Teacher ruxsatini tekshirish (to'g'ridan-to'g'ri yoki ajdod papkadan meros)
      const { inherited } = await getTeacherVisibility(user.userId);
      if (!inherited.has(id)) return res.status(403).json({ error: "Bu papkaga ruxsatingiz yo'q" });
    }

    const items = await prisma.lessonItem.findMany({
      where: { folderId: id },
      orderBy: { order: 'asc' },
    });

    res.json({ data: items });
  } catch (e) { next(e); }
};

/** POST /api/lessons/folders/:id/items */
export const addItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, url, type, order } = req.body;

    if (!title || !url) return res.status(400).json({ error: 'Mavzu nomi va link kiritilishi shart' });

    const item = await prisma.lessonItem.create({
      data: {
        folderId: id,
        title,
        url,
        type: type || 'link',
        order: order ?? 0,
      },
    });

    res.status(201).json({ data: item });
  } catch (e) { next(e); }
};

/** PATCH /api/lessons/items/:itemId
 *  folderId yuborilsa — darslikni boshqa papkaga ko'chiradi
 */
export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    const { title, url, type, order, folderId } = req.body;

    if (folderId !== undefined) {
      const dest = await prisma.lessonFolder.findUnique({ where: { id: folderId } });
      if (!dest) return res.status(404).json({ error: "Manzil papka topilmadi" });
    }

    const item = await prisma.lessonItem.update({
      where: { id: itemId },
      data: {
        ...(title !== undefined && { title }),
        ...(url !== undefined && { url }),
        ...(type !== undefined && { type }),
        ...(order !== undefined && { order }),
        ...(folderId !== undefined && { folderId }),
      },
    });

    res.json({ data: item });
  } catch (e) { next(e); }
};

/** DELETE /api/lessons/items/:itemId */
export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    await prisma.lessonItem.delete({ where: { id: itemId } });
    res.json({ message: "Darslik o'chirildi" });
  } catch (e) { next(e); }
};

// ─── Ruxsatlar ────────────────────────────────────────────────────────────────

/** GET /api/lessons/folders/:id/access — papkaga ruxsatli o'qituvchilar */
export const getFolderAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const access = await prisma.lessonFolderAccess.findMany({
      where: { folderId: id },
      include: {
        teacher: { select: { id: true, fullName: true, login: true, avatarUrl: true } },
      },
    });
    res.json({ data: access });
  } catch (e) { next(e); }
};

/** POST /api/lessons/folders/:id/access — ruxsatlar sinxronizatsiyasi */
export const syncAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { teacherIds } = req.body; // Array of teacher IDs

    if (!Array.isArray(teacherIds)) {
      return res.status(400).json({ error: "O'qituvchi IDlari ro'yxati kerak" });
    }

    // Mavjud ruxsatlarni o'chirib, yangilarini qo'shish (sync)
    await prisma.lessonFolderAccess.deleteMany({ where: { folderId: id } });

    if (teacherIds.length > 0) {
      await prisma.lessonFolderAccess.createMany({
        data: teacherIds.map((teacherId: string) => ({ folderId: id, teacherId })),
        skipDuplicates: true,
      });
    }

    const access = await prisma.lessonFolderAccess.findMany({
      where: { folderId: id },
      include: {
        teacher: { select: { id: true, fullName: true, login: true, avatarUrl: true } },
      },
    });

    res.json({ data: access });
  } catch (e) { next(e); }
};

/** GET /api/lessons/teachers — barcha o'qituvchilar ro'yxati (ruxsat berish uchun) */
export const getAllTeachers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, fullName: true, login: true, avatarUrl: true },
      orderBy: { fullName: 'asc' },
    });
    res.json({ data: teachers });
  } catch (e) { next(e); }
};
