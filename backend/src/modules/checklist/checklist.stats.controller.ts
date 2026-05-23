import { Request, Response } from 'express';
import prisma from '../../config/database';

// Checklist bor rollar
const CHECKLIST_ROLES = [
  'filial_rahbari', 'teacher', 'robototexnika_ustoz', 'assistant',
  'moliya_rahbari', 'sotuv_operatori', 'kassir', 'call_operatori',
  'farrosh', 'nazoratchi', 'hr_rahbari',
];

const ROLE_LABELS: Record<string, string> = {
  filial_rahbari: 'Filial Rahbari',
  teacher: 'Mentor (Teacher)',
  robototexnika_ustoz: 'Robototexnika Ustoz',
  assistant: 'Assistant',
  moliya_rahbari: 'Moliya Rahbari',
  sotuv_operatori: 'Sotuv Menejeri',
  kassir: 'Kassir',
  call_operatori: 'Call Operatori',
  farrosh: 'Farrosh',
  nazoratchi: 'Nazoratchi',
  hr_rahbari: 'HR Menejeri',
};

// Format: "YYYY-MM-DD"
function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

// UTC midnight Date qaytaradi
function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function getDaysInRange(from: Date, to: Date): string[] {
  const days: string[] = [];
  let cur = new Date(from.getTime());
  while (cur <= to) {
    days.push(toYMD(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export async function getChecklistStats(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || 'today';
    const dateParam = req.query.date as string;

    // Build actual today as UTC midnight based on LOCAL calendar day
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const actualTodayYMD = `${y}-${m}-${dd}`;

    const targetYMD = dateParam || actualTodayYMD;
    const targetUTC = fromYMD(targetYMD);

    let dayStrings: string[];
    if (period === 'weekly') {
      const from = addDays(targetUTC, -6);
      dayStrings = getDaysInRange(from, targetUTC);
    } else if (period === 'monthly') {
      const from = fromYMD(`${targetYMD.substring(0, 7)}-01`);
      dayStrings = getDaysInRange(from, targetUTC);
    } else {
      dayStrings = [targetYMD];
    }

    const dateFrom = fromYMD(dayStrings[0]);
    const dateTo = fromYMD(dayStrings[dayStrings.length - 1]);
    // dateTo: shu kunning oxiri (lokal)
    const dateToEnd = new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Get all checklist items
    const allItems = await prisma.checklistItem.findMany({
      where: { isActive: true, role: { in: CHECKLIST_ROLES as any[] } },
    });
    const itemsByRole: Record<string, any[]> = {};
    for (const item of allItems) {
      if (!itemsByRole[item.role]) itemsByRole[item.role] = [];
      itemsByRole[item.role].push(item);
    }

    // Get all users with checklist roles
    const users = await prisma.user.findMany({
      where: { role: { in: CHECKLIST_ROLES as any[] }, isActive: true },
      select: { id: true, fullName: true, login: true, role: true },
    });

    // Get all entries in range using DateTime range
    const entries = await prisma.dailyChecklistEntry.findMany({
      where: {
        date: { gte: dateFrom, lte: dateToEnd },
      },
    });

    // Build lookup: userId:itemId:YYYY-MM-DD -> isDone
    const entryMap = new Map<string, boolean>();
    for (const e of entries) {
      // e.date - Prisma @db.Date: local date
      const dateStr = toYMD(new Date(e.date));
      entryMap.set(`${e.userId}:${e.checklistItemId}:${dateStr}`, e.isDone);
    }

    // Build stats per role
    const roleStats = CHECKLIST_ROLES.map(role => {
      const roleItems = itemsByRole[role] || [];
      const roleUsers = users.filter(u => u.role === role);
      const totalItems = roleItems.length;

      const userStats = roleUsers.map(user => {
        const dailyData = dayStrings.map(dateStr => {
          const done = roleItems.filter(item =>
            entryMap.get(`${user.id}:${item.id}:${dateStr}`) === true
          ).length;
          return {
            date: dateStr,
            done,
            total: totalItems,
            percent: totalItems > 0 ? Math.round((done / totalItems) * 100) : 0,
          };
        });

        const todayData = dailyData.find(d => d.date === targetYMD) || { done: 0, total: totalItems, percent: 0 };
        const avgPercent = dailyData.length > 0
          ? Math.round(dailyData.reduce((s, d) => s + d.percent, 0) / dailyData.length) : 0;

        return {
          id: user.id, fullName: user.fullName, login: user.login,
          todayDone: todayData.done, todayTotal: totalItems, todayPercent: todayData.percent,
          avgPercent, dailyData,
        };
      });

      const avgToday = roleUsers.length > 0
        ? Math.round(userStats.reduce((s, u) => s + u.todayPercent, 0) / roleUsers.length) : 0;
      const avgPeriod = roleUsers.length > 0
        ? Math.round(userStats.reduce((s, u) => s + u.avgPercent, 0) / roleUsers.length) : 0;

      return {
        role, label: ROLE_LABELS[role] || role, totalItems,
        totalUsers: roleUsers.length, avgTodayPercent: avgToday, avgPeriodPercent: avgPeriod,
        users: userStats,
      };
    });

    const rolesWithUsers = roleStats.filter(r => r.totalUsers > 0);
    const sorted = [...rolesWithUsers].sort((a, b) => b.avgTodayPercent - a.avgTodayPercent);
    const overallToday = sorted.length > 0
      ? Math.round(sorted.reduce((s, r) => s + r.avgTodayPercent, 0) / sorted.length) : 0;

    return res.json({
      success: true,
      data: {
        period, days: dayStrings, targetDateStr: targetYMD,
        summary: {
          overallTodayPercent: overallToday,
          totalRoles: rolesWithUsers.length,
          totalUsers: users.length,
          bestRole: sorted[0] ? { role: sorted[0].role, label: sorted[0].label, percent: sorted[0].avgTodayPercent } : null,
          worstRole: sorted[sorted.length - 1] ? { role: sorted[sorted.length - 1].role, label: sorted[sorted.length - 1].label, percent: sorted[sorted.length - 1].avgTodayPercent } : null,
        },
        roles: roleStats.sort((a, b) => b.avgTodayPercent - a.avgTodayPercent),
      },
    });
  } catch (error: any) {
    console.error('Checklist stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
