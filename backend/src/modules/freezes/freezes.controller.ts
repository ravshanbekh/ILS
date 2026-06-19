import { Request, Response, NextFunction } from 'express';
import freezesService from './freezes.service';

class FreezesController {
  /**
   * POST /api/freezes — O'quvchini muzlatish
   * Roles: admin, administrator, sotuv_operatori, kassir
   */
  async freeze(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, reason, detailedNote, phone, startDate, filial } = req.body;
      const frozenById = (req as any).user.userId;  // JWT payload da userId field bor

      if (!studentId || !reason) {
        return res.status(400).json({ success: false, message: "studentId va reason majburiy" });
      }

      const freeze = await freezesService.freezeStudent({
        studentId,
        frozenById,
        reason,
        detailedNote,
        phone,
        startDate,
        filial,
      });

      return res.status(201).json({ success: true, data: freeze });
    } catch (err: any) {
      if (err.message === "O'quvchi topilmadi") {
        return res.status(404).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  /**
   * GET /api/freezes — Muzlatilganlar ro'yxati
   * Roles: admin, filial_rahbari, kassir
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { month, year, reason, teacherName, filial, search } = req.query as any;

      const freezes = await freezesService.getFrozen({
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        reason,
        teacherName,
        filial,
        search,
      });

      return res.json({ success: true, data: freezes });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/freezes/report — Hisobot ma'lumotlari (5 tab uchun)
   * Roles: admin, filial_rahbari, kassir
   */
  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

      const data = await freezesService.getReportData(month, year);

      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/freezes/teacher-rating — O'qituvchilar reytingi
   * Roles: admin, filial_rahbari, kassir
   */
  async getTeacherRating(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

      const data = await freezesService.getTeacherRating(month, year);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/freezes/ai-analyze — Gemini AI tahlil
   * Roles: admin, filial_rahbari, kassir
   */
  async aiAnalyze(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const month = req.body.month || now.getMonth() + 1;
      const year = req.body.year || now.getFullYear();

      const analysis = await freezesService.analyzeWithAI(month, year);
      return res.json({ success: true, analysis });
    } catch (err: any) {
      if (err.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: "Gemini API key sozlanmagan" });
      }
      if (err.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR', message: "Gemini API bilan bog'lanib bo'lmadi" });
      }
      if (err.message === 'NO_DATA') {
        return res.status(404).json({ success: false, error: 'NO_DATA', message: "Bu oy uchun ma'lumot yo'q" });
      }
      next(err);
    }
  }

  /**
   * POST /api/freezes/:id/script — Muzlatilgan o'quvchi uchun operator gaplashish skriptini yaratish
   */
  async generateScript(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ success: false, message: "Freeze ID majburiy" });
      }
      const script = await freezesService.generateOperatorScript(id);
      return res.json({ success: true, script });
    } catch (err: any) {
      if (err.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: "Gemini API key sozlanmagan" });
      }
      if (err.message === 'FREEZE_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'FREEZE_NOT_FOUND', message: "Muzlatish ma'lumoti topilmadi" });
      }
      if (err.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR', message: "Gemini API bilan bog'lanib bo'lmadi" });
      }
      next(err);
    }
  }

  /**
   * DELETE /api/freezes/:id — Muzlatishni bekor qilish
   * Roles: admin only
   */
  async unfreeze(req: Request, res: Response, next: NextFunction) {
    try {
      await freezesService.unfreeze(req.params.id as string);
      return res.json({ success: true, message: "Muzlatish bekor qilindi" });
    } catch (err) {
      next(err);
    }
  }
}

export default new FreezesController();
