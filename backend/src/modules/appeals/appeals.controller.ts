import { Request, Response, NextFunction } from 'express';
import appealsService from './appeals.service';
import { replyAppealSchema } from './appeals.validation';
import { ApiError } from '../../shared/middleware/errorHandler';
import { safeSendToParent } from '../bot/bot.notifications';

/** telegramLink.chatId BigInt — JSON.stringify uni ko'tarolmaydi, mijozga kerak ham emas */
function toClientAppeal(appeal: any) {
  const { telegramLink, ...rest } = appeal;
  return rest;
}

class AppealsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to, type, status, groupId, teacherId } = req.query as Record<string, string>;
      const appeals = await appealsService.getAll({ from, to, type: type as any, status: status as any, groupId, teacherId });
      res.json({ success: true, data: appeals });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const appeal = await appealsService.getById(req.params.id);
      res.json({ success: true, data: toClientAppeal(appeal) });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/appeals/:id/reply — javob yozish va bot orqali ota-onaga yuborish */
  async reply(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = replyAppealSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const appeal = await appealsService.reply(req.params.id, req.user!.userId, validated.data.reply);

      const chatId = (appeal as any).telegramLink?.chatId;
      if (chatId) {
        await safeSendToParent(
          chatId,
          `💬 *Murojaatingizga javob keldi*\n━━━━━━━━━━━━━━━━━━━━\n${validated.data.reply}`
        );
      }

      res.json({ success: true, data: toClientAppeal(appeal) });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const appeal = await appealsService.updateStatus(req.params.id, status);
      res.json({ success: true, data: toClientAppeal(appeal) });
    } catch (error) {
      next(error);
    }
  }

  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as Record<string, string>;
      const workbook = await appealsService.exportToExcel({ from, to });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=murojaatlar_${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
}

export default new AppealsController();
