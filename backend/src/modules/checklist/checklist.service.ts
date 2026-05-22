import prisma from '../../config/database';

export const checklistService = {
  // Bugungi yoki istalgan kun checklistini olish
  async getDayChecklist(userId: string, role: string, date: Date) {
    const items = await prisma.checklistItem.findMany({
      where: { role: role as any, isActive: true },
      orderBy: { order: 'asc' },
    });

    if (items.length === 0) return [];

    const entries = await prisma.dailyChecklistEntry.findMany({
      where: {
        userId,
        date,
        checklistItemId: { in: items.map(i => i.id) },
      },
    });

    const entryMap = new Map(entries.map(e => [e.checklistItemId, e]));

    return items.map(item => ({
      id: item.id,
      order: item.order,
      score: item.score,
      section: item.section ?? null,
      category: item.category,
      description: item.description,
      isDone: entryMap.get(item.id)?.isDone ?? false,
      doneAt: entryMap.get(item.id)?.doneAt ?? null,
    }));
  },

  // Oxirgi 7 kunlik summary (weekly strip uchun)
  async getWeeklySummary(userId: string, role: string) {
    // Oxirgi 7 kun sanalarini hisoblash (LOCAL day -> UTC midnight)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayUTC.getTime());
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d);
    }

    // Rolga tegishli itemlar sonini olish
    const items = await prisma.checklistItem.findMany({
      where: { role: role as any, isActive: true },
      select: { id: true },
    });
    const totalItems = items.length;
    const itemIds = items.map(i => i.id);

    if (totalItems === 0) {
      return days.map(d => ({
        date: d.toISOString().split('T')[0],
        done: 0,
        total: 0,
        percent: 0,
        isToday: d.getTime() === todayUTC.getTime(),
        isFuture: d.getTime() > todayUTC.getTime(),
      }));
    }

    // Barcha 7 kundagi entrylarni olish
    const startDate = days[0];
    const endDate = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

    const entries = await prisma.dailyChecklistEntry.findMany({
      where: {
        userId,
        checklistItemId: { in: itemIds },
        date: { gte: startDate, lte: endDate },
        isDone: true,
      },
      select: { date: true },
    });

    // Har kun uchun hisoblash
    const doneByDate = new Map<string, number>();
    for (const e of entries) {
      const key = e.date.toISOString().split('T')[0];
      doneByDate.set(key, (doneByDate.get(key) ?? 0) + 1);
    }

    return days.map(d => {
      const key = d.toISOString().split('T')[0];
      const done = doneByDate.get(key) ?? 0;
      const isToday = d.getTime() === todayUTC.getTime();
      const isFuture = d.getTime() > todayUTC.getTime();
      return {
        date: key,
        done,
        total: totalItems,
        percent: totalItems > 0 ? Math.round((done / totalItems) * 100) : 0,
        isToday,
        isFuture,
      };
    });
  },

  // Toggle — FAQAT bugungi kun uchun
  async toggleItem(userId: string, checklistItemId: string, today: Date) {
    const existing = await prisma.dailyChecklistEntry.findUnique({
      where: {
        userId_checklistItemId_date: { userId, checklistItemId, date: today },
      },
    });

    if (existing) {
      return prisma.dailyChecklistEntry.update({
        where: { id: existing.id },
        data: {
          isDone: !existing.isDone,
          doneAt: !existing.isDone ? new Date() : null,
        },
      });
    } else {
      return prisma.dailyChecklistEntry.create({
        data: {
          userId,
          checklistItemId,
          date: today,
          isDone: true,
          doneAt: new Date(),
        },
      });
    }
  },
};
