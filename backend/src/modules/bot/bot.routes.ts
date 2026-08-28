import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { sendDailyAIReport, generateEducationalAIReport } from './bot.ai-report';
import botService from './bot.service';
import { broadcastToParents, getBotUsername, getBotLink, ensureBotUsername } from './bot.notifications';
import { generateText, getAISettings } from '../../shared/utils/ai';
import rankingsService, { StudentCategory } from '../rankings/rankings.service';

const router = Router();

// GET /api/bot/info — Bot username va havolasi (guruh chatini ulash ekranida ko'rsatish uchun)
router.get('/info', authenticate, async (_req: Request, res: Response) => {
  // Server endigina qayta ishga tushgan bo'lsa, getMe() hali ulgurmagan bo'lishi mumkin —
  // shu holatda live urinib ko'ramiz, aks holda havola/username doim bo'sh ko'rinib qolardi.
  await ensureBotUsername();
  res.json({ success: true, data: { username: getBotUsername(), link: getBotLink() || null } });
});

// POST /api/bot/send-daily-report — Admin qo'lda AI Ta'lim hisobotini yuborishi yoki ko'rishi
router.post('/send-daily-report', authenticate, roleGuard('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = req.body; // 'send' | 'preview'
    if (action === 'preview') {
      const reportText = await generateEducationalAIReport("Qo'lda Ko'rish (Preview)");
      return res.json({ success: true, data: { report: reportText } });
    }
    const reportText = await sendDailyAIReport("Qo'lda Yuborilgan Admin Hisoboti");
    res.json({ success: true, message: "AI Ta'lim hisoboti Telegram bot orqali yuborildi", data: { report: reportText } });
  } catch (err) {
    next(err);
  }
});

// ============ OTA-ONALAR BAZASI ============

// GET /api/bot/parents — qamrov ro'yxati (kim ulangan, kim yo'q)
router.get('/parents', authenticate, roleGuard('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, teacherId } = req.query as { groupId?: string; teacherId?: string };
    const result = await botService.getParentCoverage({ groupId, teacherId });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/bot/parents/ai-polish — matnni AI bilan jilolash (yuborishdan oldin, ixtiyoriy)
router.post('/parents/ai-polish', authenticate, roleGuard('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message majburiy' });
    }
    const { apiKey } = getAISettings();
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'AI sozlanmagan (Gemini/Groq API key yo\'q)' });
    }
    const prompt = `Quyidagi o'quv markazi ota-onalariga yuboriladigan Telegram xabarini o'zbek tilida, samimiy va professional ohangda, lekin qisqa va tabiiy qilib qayta yozing. {ism} degan shablon so'zni albatta o'zgarmasdan saqlang — u yuborishda farzand ismi bilan almashtiriladi. Faqat Telegram uchun oddiy Markdown (*qalin*) ishlating, ortiqcha uzaytirmang:\n\n"${message}"`;
    const polished = await generateText(prompt, 500, 0.6);
    res.json({ success: true, data: { polished } });
  } catch (err) {
    next(err);
  }
});

// POST /api/bot/parents/broadcast — ommaviy xabar yuborish (ixtiyoriy: natija kategoriyasi bo'yicha)
router.post('/parents/broadcast', authenticate, roleGuard('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, teacherId, category, message } = req.body as {
      groupId?: string;
      teacherId?: string;
      category?: StudentCategory;
      message?: string;
    };
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message majburiy' });
    }

    let studentIds: string[] | undefined;
    if (category) {
      const categorized = await rankingsService.getStudentCategories({ groupId, teacherId });
      studentIds = categorized.students.filter((s) => s.category === category).map((s) => s.id);
    }

    const result = await broadcastToParents({ groupId, teacherId, studentIds }, message.trim());
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
