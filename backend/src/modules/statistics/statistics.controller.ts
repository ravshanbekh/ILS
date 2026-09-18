import { Request, Response, NextFunction } from 'express';
import statisticsService from './statistics.service';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import usersService from '../users/users.service';

class StatisticsController {
  /**
   * GET /api/stats/overview — Umumiy statistika (admin)
   */
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await statisticsService.getOverview();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/teachers-ranking — O'qituvchilar oylik reytingi (PDF uchun)
   */
  async getTeachersRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await statisticsService.getTeachersRanking();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/teacher — O'qituvchi statistikasi
   */
  async getTeacherStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const teacherId = req.user.role === 'teacher' ? req.user.userId : (req.query.teacherId as string);
      if (!teacherId) throw ApiError.badRequest('Teacher ID kerak');

      const stats = await statisticsService.getTeacherStats(teacherId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/group/:id — Guruh statistikasi
   */
  async getGroupStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await statisticsService.getGroupStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/student/:id — O'quvchi statistikasi
   */
  async getStudentStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();

      // O'quvchi faqat o'zini ko'ra oladi
      const studentId = req.user.role === 'student'
        ? req.user.userId
        : req.params.id;

      // ── KIRISH TEKSHIRUVI ────────────────────────────────────────────
      // Bu yo'lda roleGuard YO'Q edi: tizimga kirgan har qanday odam
      // istalgan o'quvchining to'liq statistikasini o'qiy olardi.
      //
      // Ruxsatsiz o'tadiganlar: o'quvchining o'zi, admin, va o'sha
      // o'quvchi guruhining o'qituvchisi. Qolganlarga qo'lda beriladigan
      // "O'quvchi profilini ko'rish" ruxsati kerak.
      if (req.user.role !== 'student' && req.user.role !== 'admin') {
        const ownsStudent =
          req.user.role === 'teacher' &&
          (await usersService.isStudentOfTeacher(studentId, req.user.userId));

        if (!ownsStudent && !(await hasPermission(req.user, 'view_student_profile'))) {
          throw ApiError.forbidden(
            "Bu o'quvchi sizga biriktirilmagan — \"O'quvchi profilini ko'rish\" ruxsati kerak"
          );
        }
      }

      const stats = await statisticsService.getStudentStats(studentId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/stats/student/:id/ai-analyze
   */
  async analyzeStudentWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const result = await statisticsService.analyzeStudentWithAI(req.params.id);
      res.json({ success: true, data: { analysis: result } });
    } catch (error: any) {
      if (error.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: 'Gemini API key sozlanmagan' });
      }
      if (error.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR', message: "Gemini API bilan bog'lanib bo'lmadi" });
      }
      next(error);
    }
  }
}

export default new StatisticsController();
