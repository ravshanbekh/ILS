import { Request, Response, NextFunction } from 'express';
import groupsService from './groups.service';
import { createGroupSchema, updateGroupSchema, addStudentSchema, addStudentsSchema } from './groups.validation';
import { getPagination } from '../../shared/utils/pagination';
import { ApiError } from '../../shared/middleware/errorHandler';

class GroupsController {
  /**
   * GET /api/groups
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const filters = {
        teacherId: req.query.teacherId as string | undefined,
        search: req.query.search as string | undefined,
      };

      // O'qituvchi faqat o'z guruhlarini ko'radi
      if (req.user?.role === 'teacher') {
        filters.teacherId = req.user.userId;
      }

      const result = await groupsService.getAll(pagination, filters);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/groups/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupsService.getById(req.params.id);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/groups
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createGroupSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      // Agar teacher yaratayotgan bo'lsa, o'zini teacher sifatida belgilash
      if (req.user?.role === 'teacher' && !validated.data.teacherId) {
        validated.data.teacherId = req.user.userId;
      }

      const group = await groupsService.create(validated.data, req.user?.userId);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/groups/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateGroupSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const group = await groupsService.update(req.params.id, validated.data, req.user?.userId);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/groups/:id/students — Bitta o'quvchi qo'shish
   */
  async addStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = addStudentSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await groupsService.addStudent(
        req.params.id,
        validated.data.studentId,
        req.user?.userId
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/groups/:id/students/bulk — Ko'plab o'quvchi qo'shish
   */
  async addStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = addStudentsSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await groupsService.addStudents(
        req.params.id,
        validated.data.studentIds,
        req.user?.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/groups/:id/students/:studentId
   */
  async removeStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await groupsService.removeStudent(
        req.params.id,
        req.params.studentId,
        req.user?.userId
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/groups/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await groupsService.delete(req.params.id, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new GroupsController();
