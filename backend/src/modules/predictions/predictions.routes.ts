import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import prisma from '../../config/database';

const router = Router();
router.use(authenticate);

// ─── O'quvchi ketish xavfini hisoblash ───────────────────────────────────────
function calculateDropoutRisk(student: any): { risk: number; factors: string[] } {
  let risk = 0;
  const factors: string[] = [];

  const submissions = student.submissions || [];
  const monitoringNotes = student.monitoringNotes || [];
  const frozenEntries = student.frozenEntries || [];

  // 1. Oxirgi 5 topshiriqdagi qizil foizi
  const recentSubmissions = submissions
    .filter((s: any) => s.status === 'checked')
    .slice(-5);
  const recentRedPercent =
    recentSubmissions.filter((s: any) => s.result === 'red').length /
    (recentSubmissions.length || 1);
  if (recentRedPercent > 0.6) {
    risk += 25;
    factors.push("Oxirgi topshiriqlarning 60%+ qizil");
  } else if (recentRedPercent > 0.4) {
    risk += 15;
    factors.push("Oxirgi topshiriqlarning 40%+ qizil");
  }

  // 2. Faolsizlik (oxirgi topshiriq qachon)
  const sortedSubs = [...submissions].sort(
    (a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  const lastSubmission = sortedSubs[0];
  if (lastSubmission) {
    const daysSince =
      (Date.now() - new Date(lastSubmission.submittedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince > 21) {
      risk += 30;
      factors.push(`${Math.round(daysSince)} kun topshiriq topshirmagan`);
    } else if (daysSince > 14) {
      risk += 20;
      factors.push(`${Math.round(daysSince)} kun topshiriq topshirmagan`);
    } else if (daysSince > 7) {
      risk += 10;
      factors.push(`${Math.round(daysSince)} kun topshiriq topshirmagan`);
    }
  } else {
    risk += 35;
    factors.push("Hech qachon topshiriq topshirmagan");
  }

  // 3. Monitoring kayfiyati (oxirgi 3 ta)
  const recentMoods = monitoringNotes.slice(-3);
  const badMoods = recentMoods.filter(
    (n: any) => n.mood === 'yomon' || n.mood === 'javob_bermadi'
  ).length;
  if (badMoods >= 2) {
    risk += 20;
    factors.push("Monitoring: 2+ marta salbiy kayfiyat");
  } else if (badMoods >= 1) {
    risk += 10;
    factors.push("Monitoring: salbiy kayfiyat qayd etilgan");
  }

  // 4. Muzlatish tarixi
  const freezeCount = frozenEntries.length || 0;
  if (freezeCount >= 2) {
    risk += 15;
    factors.push(`${freezeCount} marta muzlatilgan`);
  } else if (freezeCount >= 1) {
    risk += 8;
    factors.push("1 marta muzlatilgan");
  }

  // 5. Ball o'sish trendi (tushayotganmi?)
  if (recentSubmissions.length >= 3) {
    const scores = recentSubmissions.map((s: any) => s.score);
    const trend = scores[scores.length - 1] - scores[0];
    if (trend < -10) {
      risk += 10;
      factors.push("Ball trendi pasaymoqda");
    }
  }

  return { risk: Math.min(risk, 99), factors };
}

// GET /api/predictions/dropout — O'quvchilar ketish xavfi bashorati
router.get('/dropout', roleGuard('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'student', isActive: true },
      include: {
        submissions: {
          where: { status: 'checked' },
          orderBy: { submittedAt: 'asc' },
        },
        monitoringNotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        frozenEntries: true,
        groupStudents: {
          include: {
            group: {
              include: {
                teacher: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    const predictions = students.map(student => {
      const { risk, factors } = calculateDropoutRisk(student);
      const riskLevel = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
      const primaryGroup = student.groupStudents[0]?.group;

      return {
        studentId: student.id,
        studentName: student.fullName,
        groupName: primaryGroup?.name || 'Guruhsiz',
        teacherName: primaryGroup?.teacher?.fullName || 'Belgilanmagan',
        risk,
        riskLevel,
        factors,
      };
    });

    // Sort by risk descending
    predictions.sort((a, b) => b.risk - a.risk);

    const summary = {
      high: predictions.filter(p => p.riskLevel === 'high').length,
      medium: predictions.filter(p => p.riskLevel === 'medium').length,
      low: predictions.filter(p => p.riskLevel === 'low').length,
      total: predictions.length,
    };

    res.json({ success: true, data: { predictions, summary } });
  } catch (err) {
    next(err);
  }
});

// GET /api/predictions/revenue — Kelgusi 3 oy revenue bashorati
router.get('/revenue', roleGuard('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const monthlyFee = 600000; // so'm

    // Oxirgi 6 oy freeze statistikasi
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthNum = d.getMonth() + 1;
      const yearNum = d.getFullYear();
      const count = await prisma.studentFreeze.count({
        where: { month: monthNum, year: yearNum },
      });
      months.push({ month: monthNum, year: yearNum, frozenCount: count });
    }

    // Trend hisoblash
    const avg = months.reduce((s, m) => s + m.frozenCount, 0) / months.length;
    const lastMonth = months[months.length - 1].frozenCount;
    const trend =
      lastMonth > avg ? 'increasing' : lastMonth < avg ? 'decreasing' : 'stable';

    // Bashorat
    const forecast = [1, 2, 3].map(i => {
      const projected = Math.max(0, Math.round(lastMonth + (lastMonth - avg) * 0.3 * i));
      const potentialLoss = projected * monthlyFee;
      const recoverableRevenue = Math.round(potentialLoss * 0.4);
      return { monthsAhead: i, projectedFrozen: projected, potentialLoss, recoverableRevenue };
    });

    // Active students count
    const activeStudents = await prisma.user.count({
      where: { role: 'student', isActive: true },
    });

    res.json({
      success: true,
      data: {
        history: months,
        forecast,
        trend,
        monthlyFee,
        activeStudents,
        summary: {
          avgMonthlyFreeze: Math.round(avg),
          lastMonthFreeze: lastMonth,
          trendDirection: trend,
          maxForecastLoss: forecast[2]?.potentialLoss || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
