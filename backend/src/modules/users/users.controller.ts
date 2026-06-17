import { Request, Response, NextFunction } from 'express';
import usersService from './users.service';
import { createUserSchema, updateUserSchema } from './users.validation';
import { getPagination } from '../../shared/utils/pagination';
import { ApiError } from '../../shared/middleware/errorHandler';

class UsersController {
  /**
   * GET /api/users/my-students — Teacher uchun o'z o'quvchilarini olish (tezkor)
   */
  async getMyStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const search = req.query.search as string | undefined;
      const teacherId = req.user?.userId!;
      const result = await usersService.getMyStudents(teacherId, pagination, search);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users — Barcha foydalanuvchilar
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const filters = {
        role: req.query.role as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await usersService.getAll(pagination, filters);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/ungrouped — Hech bir guruhda bo'lmagan o'quvchilar
   */
  async getUngrouped(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const data = await usersService.getUngrouped(search);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:id — Bitta foydalanuvchi
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users — Yangi foydalanuvchi
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createUserSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      // Teacherlar faqat student yarata olishi kerak
      if (req.user?.role === 'teacher' && validated.data.role !== 'student') {
        throw ApiError.forbidden("O'qituvchilar faqat o'quvchi (student) rolini yarata oladi");
      }

      const user = await usersService.create(validated.data, req.user?.userId);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/bulk — Ko'p foydalanuvchi yaratish
   */
  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!Array.isArray(req.body.users)) {
        throw ApiError.badRequest("users ro'yxati (array) bo'lishi kerak");
      }

      // Teacherlar faqat student yarata olishini tekshirish
      if (req.user?.role === 'teacher') {
        const hasNonStudent = req.body.users.some((u: any) => u.role !== 'student');
        if (hasNonStudent) {
          throw ApiError.forbidden("O'qituvchilar faqat o'quvchi (student) rolini yarata oladi");
        }
      }

      const result = await usersService.bulkCreate(req.body.users, req.user?.userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/:id — Foydalanuvchini yangilash
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateUserSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      // Agar teacher bo'lsa, avval mavjud userni topamiz
      if (req.user?.role === 'teacher') {
        const existingUser = await usersService.getById(req.params.id);
        if (existingUser?.role !== 'student') {
          throw ApiError.forbidden("O'qituvchilar faqat o'quvchilarni tahrirlay oladi");
        }
        if (validated.data.role && validated.data.role !== 'student') {
            throw ApiError.forbidden("O'quvchi rolini o'zgartirish mumkin emas");
        }
      }

      const user = await usersService.update(
        req.params.id,
        validated.data,
        req.user?.userId
      );
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/:id — Foydalanuvchini o'chirish
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.delete(req.params.id, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new UsersController();
