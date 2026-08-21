import { Request, Response, NextFunction } from 'express';
import lessonSessionsService from './lesson-sessions.service';
import {
  startSessionSchema,
  gradeHomeworkSchema,
  gradeActivitySchema,
  adminUnlockSchema,
} from './lesson-sessions.validation';
import { ApiError } from '../../shared/middleware/errorHandler';

function isAdminRole(role?: string) {
  return role === 'admin' || role === 'administrator';
}

class LessonSessionsController {
  /** POST /api/lesson-sessions/start */
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = startSessionSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const session = await lessonSessionsService.start(
        validated.data.groupId,
        req.user!.userId,
        isAdminRole(req.user?.role),
        validated.data.topic
      );
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/lesson-sessions/today?groupId=... */
  async today(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.query.groupId as string;
      if (!groupId) throw ApiError.badRequest('groupId talab qilinadi');
      const result = await lessonSessionsService.getToday(groupId, req.user!.userId, isAdminRole(req.user?.role));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/lesson-sessions/:id */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await lessonSessionsService.getById(req.params.id);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/lesson-sessions/:id/homework */
  async gradeHomework(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = gradeHomeworkSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const session = await lessonSessionsService.gradeHomework(
        req.params.id,
        req.user!.userId,
        isAdminRole(req.user?.role),
        validated.data.studentId,
        validated.data.homework,
        validated.data.comment
      );
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/lesson-sessions/:id/activity */
  async gradeActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = gradeActivitySchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const session = await lessonSessionsService.gradeActivity(
        req.params.id,
        req.user!.userId,
        isAdminRole(req.user?.role),
        validated.data.studentId,
        validated.data.activityScore
      );
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/lesson-sessions/:id/finalize */
  async finalize(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await lessonSessionsService.finalize(
        req.params.id,
        req.user!.userId,
        isAdminRole(req.user?.role)
      );
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/lesson-sessions/admin/unlock — faqat admin */
  async adminUnlock(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = adminUnlockSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const session = await lessonSessionsService.adminUnlock(
        validated.data.groupId,
        req.user!.userId,
        validated.data.note,
        validated.data.date ? new Date(validated.data.date) : undefined
      );
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/lesson-sessions/admin/ungraded — faqat admin, bugungi nazorat hisoboti */
  async adminUngraded(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await lessonSessionsService.getUngradedGroupsToday();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new LessonSessionsController();
