import { Request, Response, NextFunction } from 'express';
import submissionsService from './submissions.service';
import { createSubmissionSchema, checkSubmissionSchema } from './submissions.validation';
import { getPagination } from '../../shared/utils/pagination';
import { ApiError } from '../../shared/middleware/errorHandler';

class SubmissionsController {
  /**
   * GET /api/submissions — Tekshirilmagan topshiriqlar (teacher)
   */
  async getPending(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const filters: { groupId?: string; teacherId?: string } = {
        groupId: req.query.groupId as string | undefined,
      };

      // O'qituvchi faqat o'z guruhlarini ko'radi
      if (req.user?.role === 'teacher') {
        filters.teacherId = req.user.userId;
      }

      const result = await submissionsService.getPending(pagination, filters);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/submissions/all — Barcha topshiriqlar (admin)
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const result = await submissionsService.getAll(pagination);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/submissions/student/:id — O'quvchi topshiriqlari
   */
  async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const studentId = req.params.id;

      // O'quvchi faqat o'zini ko'radi
      if (req.user?.role === 'student' && req.user.userId !== studentId) {
        throw ApiError.forbidden('Faqat o\'z topshiriqlaringizni ko\'rishingiz mumkin');
      }

      const result = await submissionsService.getByStudent(studentId, pagination);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/submissions/:id — Bitta submission
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await submissionsService.getById(req.params.id);
      res.json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/submissions — Topshirish (student)
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const validated = createSubmissionSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const submission = await submissionsService.create(req.user.userId, validated.data);
      res.status(201).json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/submissions/:id/check — Baholash (teacher)
   */
  async check(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const validated = checkSubmissionSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await submissionsService.check(
        req.params.id,
        req.user.userId,
        validated.data
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/submissions/:id/allow-resubmit — Qayta topshirishga ruxsat (teacher/admin)
   */
  async allowResubmit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const result = await submissionsService.allowResubmit(
        req.params.id,
        req.user.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new SubmissionsController();
