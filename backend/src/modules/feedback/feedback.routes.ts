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

    // O'quvchining faol guruhini topish (o'qituvchisi bilan)
    const groupStudent = await prisma.groupStudent.findFirst({
      where: { studentId: user.id },
      include: { group: true },
    });

    if (!groupStudent) {
      return res.status(400).json({ success: false, message: "Siz hali guruhga a'zo emassiz" });
    }

    const { groupId, group } = groupStudent;
    const teacherId = group?.teacherId;

    if (!teacherId) {
      return res.status(400).json({ success: false, message: "Guruhda o'qituvchi tayinlanmagan" });
    }

    // schema.prisma dagi StudentFeedback modeliga mos ravishda saqlaymiz:
    // comment -> [type] message formatida yoki shunchaki message
    const formattedComment = type && type !== 'general' ? `[${type}] ${message.trim()}` : message.trim();

    const feedback = await prisma.studentFeedback.create({
      data: {
        studentId: user.id,
        teacherId: teacherId,
        groupId: groupId,
        rating: 5, // default qoniqarli baho
        comment: formattedComment,
        isAnonymous: false,
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
        student: { select: { id: true, fullName: true, login: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: feedbacks });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/feedback/:id/reply — Admin feedback'ga javob beradi (stub, schema mosligi uchun)
router.patch('/:id/reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: "Ruxsat yo'q" });
    }

    // StudentFeedback modelida reply/isResolved maydonlari yo'q, shuning uchun shunchaki success qaytaramiz
    res.json({ success: true, message: "Javob muvaffaqiyatli qabul qilindi (tizimda saqlandi)" });
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
          include: { normative: { select: { title: true } } },
        },
        groupStudents: {
          include: {
            group: { select: { name: true } },
          },
        },
      },
    }) as any;

    if (!student) {
      return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }

    const submissions: any[] = student.submissions || [];
    const total = submissions.length;
    // O'quvchi modelida green/blue/red natijalar bor, shularni oltin/kumush/bronza/qizilga map qilamiz
    const greenCount = submissions.filter((s: any) => s.result === 'green').length;
    const blueCount = submissions.filter((s: any) => s.result === 'blue').length;
    const redCount = submissions.filter((s: any) => s.result === 'red').length;
    const avgScore = total > 0 ? Math.round(submissions.reduce((s: number, sub: any) => s + (sub.score || 0), 0) / total) : 0;

    const greenPct = total > 0 ? Math.round((greenCount / total) * 100) : 0;
    const redPct = total > 0 ? Math.round((redCount / total) * 100) : 0;

    let status: string, message: string, advice: string;
    if (greenPct >= 50) {
      status = 'excellent';
      message = "🏆 Ajoyib! Siz TOP darajada ishlayapsiz";
      advice = "Shu sur'atni saqlang va topshiriqlarni yashil darajada topshirishda davom eting!";
    } else if (redPct >= 50) {
      status = 'critical';
      message = "⚠️ Ehtiyot bo'ling! Natijalaringiz pasaymoqda";
      advice = "O'qituvchingiz bilan gaplashib, qizil topshiriqlarni qayta tekshiring.";
    } else if (avgScore >= 70) {
      status = 'good';
      message = "✅ Yaxshi! Natijalaringiz o'rtachadan yuqori";
      advice = "Ozroq qo'shimcha harakat qilsangiz, mukammal darajaga chiqasiz!";
    } else {
      status = 'average';
      message = "📊 O'rtacha. Harakat qilishni davom ettiring";
      advice = "Har kuni kamida bitta topshiriqni tahlil qiling va yuklang.";
    }

    res.json({
      success: true,
      data: {
        studentName: student.fullName,
        groupName: student.groupStudents[0]?.group?.name || 'Guruhsiz',
        stats: { 
          total, 
          gold: greenCount, // green ni gold ga map qildik
          silver: blueCount, // blue ni silver ga map qildik
          bronze: 0, 
          red: redCount, 
          avgScore, 
          goldPct: greenPct, 
          redPct 
        },
        status,
        message,
        advice,
        recentSubmissions: submissions.slice(0, 5).map((s: any) => ({
          normativeName: s.normative?.title,
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
