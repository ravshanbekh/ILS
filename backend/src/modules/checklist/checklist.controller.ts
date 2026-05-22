import { Request, Response } from 'express';
import { checklistService } from './checklist.service';
import { ApiError } from '../../shared/middleware/errorHandler';

function parseDateParam(dateStr?: string): Date {
  const now = new Date();
  const localTodayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (!dateStr) return localTodayUTC;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return localTodayUTC;
  return new Date(Date.UTC(y, m - 1, d));
}

function getTodayMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export const checklistController = {
  // Bugungi checklist
  async getToday(req: Request, res: Response) {
    const { userId, role } = req.user!;
    const today = getTodayMidnight();
    const items = await checklistService.getDayChecklist(userId, role, today);
    const done = items.filter(i => i.isDone).length;
    const total = items.length;
    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        isToday: true,
        isReadOnly: false,
        items,
        progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 },
      },
    });
  },

  // Istalgan kunning checklistini ko'rish (read-only)
  async getDay(req: Request, res: Response) {
    const { userId, role } = req.user!;
    const date = parseDateParam(req.query.date as string);
    const today = getTodayMidnight();
    const isToday = date.getTime() === today.getTime();
    const isFuture = date.getTime() > today.getTime();

    const items = await checklistService.getDayChecklist(userId, role, date);
    const done = items.filter(i => i.isDone).length;
    const total = items.length;
    res.json({
      success: true,
      data: {
        date: date.toISOString().split('T')[0],
        isToday,
        isFuture,
        isReadOnly: !isToday,
        items,
        progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 },
      },
    });
  },

  // Haftalik 7 kun summary
  async getWeekly(req: Request, res: Response) {
    const { userId, role } = req.user!;
    const weekly = await checklistService.getWeeklySummary(userId, role);
    res.json({ success: true, data: weekly });
  },

  // Toggle — FAQAT bugungi kun uchun (server himoyasi)
  async toggle(req: Request, res: Response) {
    const { userId } = req.user!;
    const { itemId } = req.params;
    const today = getTodayMidnight();

    // Agar request body'da date kelsa, tekshir
    const requestedDate = req.body?.date
      ? parseDateParam(req.body.date)
      : today;

    if (requestedDate.getTime() !== today.getTime()) {
      throw new ApiError(403, 'Faqat bugungi kunning checklistini o\'zgartirish mumkin');
    }

    const entry = await checklistService.toggleItem(userId, itemId, today);
    res.json({ success: true, data: entry });
  },
};
