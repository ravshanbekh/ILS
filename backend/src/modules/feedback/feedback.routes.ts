import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import prisma from '../../config/database';

const router = Router();
router.use(authenticate);

// POST /api/feedback — O'quvchi feedback beradi
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'student') {
      return res.status(403).json({ success: false, message: "Faqat o'quvchilar feedback bera oladi" });
    }

    const { message, type } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Feedback matni bo'sh bo'lishi mumkin emas" });
    }

    const feedback = await prisma.studentFeedback.create({
      data: {
        studentId: user.id,
        message: message.trim(),
        type: type || 'general',
      },
    });

    res.json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
});

// GET /api/feedback/my — O'z feedbacklarini ko'rish
router.get('/my', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const feedbacks = await prisma.studentFeedback.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: feedbacks });
  } catch (err) {
    next(err);
  }
});

// GET /api/feedback — Admin: barcha feedbacklar
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: "Ruxsat yo'q" });
    }

    const feedbacks = await prisma.studentFeedback.findMany({
      include: {
        student: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: feedbacks });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/feedback/:id/reply — Admin feedback'ga javob beradi
router.patch('/:id/reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: "Ruxsat yo'q" });
    }

    const { reply } = req.body;
    const updated = await prisma.studentFeedback.update({
      where: { id: req.params.id },
      data: { reply, repliedAt: new Date(), isResolved: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/feedback/ai-analysis — O'quvchining AI tahlilini ko'rish (o'zi uchun)
router.get('/ai-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'student') {
      return res.status(403).json({ success: false, message: "Faqat o'quvchilar uchun" });
    }

    const student = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        submissions: {
          where: { status: 'checked' },
          orderBy: { submittedAt: 'desc' },
          take: 20,
          include: { normative: { select: { name: true, gender: true } } },
        },
        groupStudents: {
          include: {
            group: { select: { name: true } },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }

    const submissions = student.submissions;
    const total = submissions.length;
    const gold = submissions.filter(s => s.result === 'gold').length;
    const silver = submissions.filter(s => s.result === 'silver').length;
    const bronze = submissions.filter(s => s.result === 'bronze').length;
    const red = submissions.filter(s => s.result === 'red').length;
    const avgScore = total > 0 ? Math.round(submissions.reduce((s, sub) => s + (sub.score || 0), 0) / total) : 0;

    const goldPct = total > 0 ? Math.round((gold / total) * 100) : 0;
    const redPct = total > 0 ? Math.round((red / total) * 100) : 0;

    let status: string, message: string, advice: string;
    if (goldPct >= 50) {
      status = 'excellent';
      message = "🏆 Ajoyib! Siz TOP darajada ishlayapsiz";
      advice = "Shu sur'atni saqlang va boshqalarga yordam berishga harakat qiling!";
    } else if (redPct >= 50) {
      status = 'critical';
      message = "⚠️ Ehtiyot bo'ling! Ko'pchilik natijalaringiz past";
      advice = "O'qituvchingiz bilan gaplashing va qo'shimcha mashqlar bajaring.";
    } else if (avgScore >= 70) {
      status = 'good';
      message = "✅ Yaxshi! Natijalaringiz o'rtachadan yuqori";
      advice = "Ozroq qo'shimcha harakat qilsangiz, yuqori darajaga chiqasiz!";
    } else {
      status = 'average';
      message = "📊 O'rtacha. Harakat qilishni davom ettiring";
      advice = "Har kuni bitta normativga e'tibor bering va natijalarni kuzating.";
    }

    res.json({
      success: true,
      data: {
        studentName: student.fullName,
        groupName: student.groupStudents[0]?.group?.name || 'Guruhsiz',
        stats: { total, gold, silver, bronze, red, avgScore, goldPct, redPct },
        status,
        message,
        advice,
        recentSubmissions: submissions.slice(0, 5).map(s => ({
          normativeName: s.normative?.name,
          score: s.score,
          result: s.result,
          submittedAt: s.submittedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
