import { Request, Response } from 'express';
import prisma from '../../config/database';

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Lokal vaqt emas, UTC midnight kerak Prisma uchun
function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function getUserChecklistDetail(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const dateStr = (req.query.date as string) || toYMD(new Date());

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const date = fromYMD(dateStr);

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, login: true, role: true, avatarUrl: true },
    });
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });

    // Get all checklist items for this role
    const items = await prisma.checklistItem.findMany({
      where: { role: user.role as any, isActive: true },
      orderBy: [{ section: 'asc' }, { order: 'asc' }],
    });

    // Get entries for this specific date (exact match)
    const entries = await prisma.dailyChecklistEntry.findMany({
      where: {
        userId,
        date,
      },
    });

    const entryMap = new Map<string, { isDone: boolean; doneAt: Date | null }>();
    for (const e of entries) {
      entryMap.set(e.checklistItemId, { isDone: e.isDone, doneAt: e.doneAt });
    }

    // Group by section
    const sections: Record<string, any[]> = {};
    for (const item of items) {
      const sec = item.section || 'Umumiy';
      if (!sections[sec]) sections[sec] = [];
      const entry = entryMap.get(item.id);
      sections[sec].push({
        id: item.id,
        order: item.order,
        category: item.category,
        description: item.description,
        score: item.score,
        isDone: entry?.isDone ?? false,
        doneAt: entry?.doneAt ?? null,
      });
    }

    const totalItems = items.length;
    const doneItems = [...entryMap.values()].filter(e => e.isDone).length;
    const totalScore = items.reduce((s, i) => s + i.score, 0);
    const earnedScore = items
      .filter(i => entryMap.get(i.id)?.isDone)
      .reduce((s, i) => s + i.score, 0);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          login: user.login,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        date: dateStr,
        summary: {
          totalItems,
          doneItems,
          notDoneItems: totalItems - doneItems,
          completionPercent: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
          totalScore,
          earnedScore,
        },
        sections: Object.entries(sections).map(([name, sectionItems]) => ({
          name,
          items: sectionItems,
          doneCount: sectionItems.filter(i => i.isDone).length,
          total: sectionItems.length,
        })),
      },
    });
  } catch (error: any) {
    console.error('User checklist detail error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
