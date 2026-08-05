import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { sendDailyAIReport, generateEducationalAIReport } from './bot.ai-report';

const router = Router();

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

export default router;
