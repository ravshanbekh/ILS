import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';

// ─── Papkalar ──────────────────────────────────────────────────────────────────

/** GET /api/lessons/folders
 *  admin → barcha papkalar + item count
 *  teacher → faqat ruxsat berilganlar
 */
export const getFolders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const isAdmin = ['admin', 'administrator', 'filial_rahbari'].includes(user.role);

    let folders;
    if (isAdmin) {
      folders = await prisma.lessonFolder.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { items: true, access: true } },
        },
      });
    } else {
      // Teacher — faqat ruxsat berilganlar
      folders = await prisma.lessonFolder.findMany({
        where: {
          access: { some: { teacherId: user.userId } },
        },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { items: true } },
        },
      });
    }

    res.json({ data: folders });
  } catch (e) { next(e); }
};

/** POST /api/lessons/folders */
export const createFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, icon, order } = req.body;
    if (!name) return res.status(400).json({ error: 'Papka nomi kiritilishi shart' });

    const folder = await prisma.lessonFolder.create({
      data: {
        name,
        description: description || null,
        icon: icon || '📁',
        order: order ?? 0,
        createdById: req.user!.userId,
      },
      include: { _count: { select: { items: true, access: true } } },
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
      include: { _count: { select: { items: true, access: true } } },
    });

    res.json({ data: folder });
  } catch (e) { next(e); }
};

/** DELETE /api/lessons/folders/:id */
export const deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // Cascade: items va access ham o'chadi
    await prisma.lessonFolder.delete({ where: { id } });
    res.json({ message: "Papka o'chirildi" });
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
      // Teacher ruxsatini tekshirish
      const access = await prisma.lessonFolderAccess.findUnique({
        where: { folderId_teacherId: { folderId: id, teacherId: user.userId } },
      });
      if (!access) return res.status(403).json({ error: "Bu papkaga ruxsatingiz yo'q" });
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

/** PATCH /api/lessons/items/:itemId */
export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    const { title, url, type, order } = req.body;

    const item = await prisma.lessonItem.update({
      where: { id: itemId },
      data: {
        ...(title !== undefined && { title }),
        ...(url !== undefined && { url }),
        ...(type !== undefined && { type }),
        ...(order !== undefined && { order }),
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
