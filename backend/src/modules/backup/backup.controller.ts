import { Request, Response, NextFunction } from 'express';
import backupService from './backup.service';

/**
 * BigInt ni JSON ga yozish uchun.
 *
 * Sxemada to'rtta BigInt maydon bor (telegram_chat_id, telegram_id, chat_id).
 * `JSON.stringify` BigInt ni ko'rsa "Do not know how to serialize a BigInt"
 * deb yiqiladi — bu loyihada ilgari ham productionda 500 xatoga sabab
 * bo'lgan. Eski zaxira faqat 8 ta jadvalni olgani uchun bu maydonlarga
 * tegmasdi; endi hamma jadval olinadi, ya'ni ular albatta uchraydi.
 *
 * Qiymat satr sifatida yoziladi. Tiklashda Prisma satrni BigInt ga
 * o'zi o'giradi.
 */
function bigIntSafe(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

class BackupController {
  /** GET /api/backup/download — butun bazani JSON qilib yuklab olish */
  async downloadBackup(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await backupService.createBackup();
      const jsonString = JSON.stringify(data, bigIntSafe, 2);

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=ils-backup-${stamp}.json`);
      res.send(jsonString);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/backup/inspect — faylni TEKSHIRADI, hech narsa o'zgartirmaydi.
   * Tiklashdan oldin "nima bo'ladi?" degan savolga javob beradi.
   */
  async inspectBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await backupService.inspectBackup(req.body);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/backup/restore — xavfli operatsiya */
  async restoreBackup(req: Request, res: Response, next: NextFunction) {
    try {
      // `force` faqat ataylab yuborilganda ishlaydi. Usiz ma'lumot
      // yo'qotadigan zaxira rad etiladi (backup.service ichida).
      const force = req.query.force === 'true' || req.body?.force === true;
      const result = await backupService.restoreBackup(req.body, { force });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new BackupController();
