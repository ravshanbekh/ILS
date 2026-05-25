import { Router } from 'express';
import { checklistController } from './checklist.controller';
import { getChecklistStats } from './checklist.stats.controller';
import { getUserChecklistDetail } from './checklist.detail.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import prisma from '../../config/database';

const router = Router();

// Xodimlar uchun
router.get('/today', authenticate, checklistController.getToday);
router.get('/day', authenticate, checklistController.getDay);        // ?date=YYYY-MM-DD
router.get('/weekly', authenticate, checklistController.getWeekly);  // oxirgi 7 kun
router.post('/:itemId/toggle', authenticate, checklistController.toggle);

// Admin/Nazoratchi uchun statistika
router.get('/admin-stats', authenticate, getChecklistStats);

// Xodim detail ko'rinishi
router.get('/user-detail/:userId', authenticate, getUserChecklistDetail);

// Role bo'yicha checklist items (o'qish)
router.get('/items', authenticate, async (req: any, res: any) => {
  const role = req.query.role as string;
  if (!role) return res.status(400).json({ success: false, message: 'role query param required' });
  const items = await prisma.checklistItem.findMany({
    where: { role: role as any, isActive: true },
    orderBy: [{ section: 'asc' }, { order: 'asc' }],
    select: { id: true, category: true, description: true, order: true, section: true, score: true },
  });
  return res.json({ success: true, data: items });
});

// Admin: barcha rollar uchun checklist items (boshqaruv sahifasi)
router.get('/manage/items', authenticate, async (req: any, res: any) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'nazoratchi') {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  const roleFilter = req.query.role as string | undefined;
  const items = await prisma.checklistItem.findMany({
    where: { isActive: true, ...(roleFilter ? { role: roleFilter as any } : {}) },
    orderBy: [{ role: 'asc' }, { section: 'asc' }, { order: 'asc' }],
  });
  return res.json({ success: true, data: items });
});

// Admin: yangi checklist item qo'shish
router.post('/manage/items', authenticate, async (req: any, res: any) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'nazoratchi') {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  const { role: itemRole, section, category, description, score, order } = req.body;
  if (!itemRole || !category) {
    return res.status(400).json({ success: false, message: 'role va category majburiy' });
  }
  // Auto-compute order if not provided
  let finalOrder = order;
  if (!finalOrder) {
    const last = await prisma.checklistItem.findFirst({
      where: { role: itemRole as any },
      orderBy: { order: 'desc' },
    });
    finalOrder = (last?.order ?? 0) + 1;
  }
  const item = await prisma.checklistItem.create({
    data: {
      role: itemRole as any,
      section: section || null,
      category,
      description: description || null,
      score: score ? Number(score) : 1,
      order: finalOrder,
    },
  });
  return res.json({ success: true, data: item });
});

// Admin: checklist item yangilash
router.put('/manage/items/:id', authenticate, async (req: any, res: any) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'nazoratchi') {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  const { id } = req.params;
  const { section, category, description, score, order } = req.body;
  const item = await prisma.checklistItem.update({
    where: { id },
    data: {
      ...(section !== undefined ? { section } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(score !== undefined ? { score: Number(score) } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
    },
  });
  return res.json({ success: true, data: item });
});

// Admin: checklist item o'chirish
router.delete('/manage/items/:id', authenticate, async (req: any, res: any) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'nazoratchi') {
    return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
  }
  const { id } = req.params;
  await prisma.checklistItem.update({ where: { id }, data: { isActive: false } });
  return res.json({ success: true, message: 'O\'chirildi' });
});

export default router;
