import { Request, Response, NextFunction } from 'express';
import homeworkService from './homework.service';
import { ApiError } from '../../shared/middleware/errorHandler';

class HomeworkController {
  // ── Bank (admin) ────────────────────────────────────────────────────

  /** GET /api/homework/bank?lessonItemId=&folderId= */
  async listBank(req: Request, res: Response, next: NextFunction) {
    try {
      const { lessonItemId, folderId } = req.query as Record<string, string | undefined>;
      if (lessonItemId) {
        const data = await homeworkService.listByLessonItem(lessonItemId, true);
        return res.json({ success: true, data });
      }
      if (folderId) {
        const data = await homeworkService.listByFolder(folderId);
        return res.json({ success: true, data });
      }
      throw ApiError.badRequest('lessonItemId yoki folderId talab qilinadi');
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/homework/bank */
  async createBank(req: Request, res: Response, next: NextFunction) {
    try {
      const { lessonItemId, title, description, contentType, content, order } = req.body;
      if (!lessonItemId || !title || !content) {
        throw ApiError.badRequest('lessonItemId, title va content majburiy');
      }
      const hw = await homeworkService.create(
        { lessonItemId, title, description, contentType: contentType || 'text', content, order },
        req.user!.userId
      );
      res.status(201).json({ success: true, data: hw });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/homework/bank/:id */
  async updateBank(req: Request, res: Response, next: NextFunction) {
    try {
      const hw = await homeworkService.update(req.params.id, req.body);
      res.json({ success: true, data: hw });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/homework/bank/:id */
  async deleteBank(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await homeworkService.remove(req.params.id);
      res.json({
        success: true,
        data: result,
        message: result.hidden
          ? "Bu vazifa guruhlarga berilgan — o'chirilmadi, yashirildi"
          : "Vazifa o'chirildi",
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Berish (o'qituvchi) ─────────────────────────────────────────────

  /** GET /api/homework/session/:sessionId/options */
  async getAssignOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await homeworkService.getAssignOptions(req.params.sessionId, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/homework/session/:sessionId/assign */
  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { homeworkId, note } = req.body;
      if (!homeworkId) throw ApiError.badRequest('homeworkId talab qilinadi');
      const data = await homeworkService.assign(
        req.params.sessionId,
        homeworkId,
        typeof note === 'string' ? note : null,
        req.user!
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/homework/session/:sessionId/assign */
  async unassign(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await homeworkService.unassign(req.params.sessionId, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/homework/session/:sessionId/to-grade — shu darsda nima baholanadi */
  async getToGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await homeworkService.getToGradeBySession(req.params.sessionId, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ── O'quvchi ────────────────────────────────────────────────────────

  /** GET /api/homework/mine */
  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await homeworkService.getStudentHomework(req.user!.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new HomeworkController();
