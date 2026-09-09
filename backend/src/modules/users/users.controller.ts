import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import usersService from './users.service';
import prisma from '../../config/database';
import { createUserSchema, updateUserSchema } from './users.validation';
import { getPagination } from '../../shared/utils/pagination';
import { ApiError } from '../../shared/middleware/errorHandler';
import { FILIALS, isValidFilial, filialLabel } from '../../shared/constants/filials';

class UsersController {
  /** GET /api/users/filials — tanlash uchun filiallar ro'yxati */
  async getFilials(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: FILIALS });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/me/avatar — o'z profil rasmini yuklash.
   * Assistent kartochkasi uchun kerak, lekin har qanday rol o'z rasmini qo'ya oladi.
   */
  async uploadMyAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw ApiError.badRequest('Rasm yuklanmadi');

      const userId = req.user!.userId;
      const url = `/uploads/avatars/${req.file.filename}`;

      // Eski rasmni diskdan o'chiramiz — aks holda har yuklashda fayl yig'ilib boradi
      const before = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });
      if (before?.avatarUrl?.startsWith('/uploads/avatars/')) {
        const oldPath = path.join(process.cwd(), 'data', before.avatarUrl.replace('/uploads/', 'uploads/'));
        fs.promises.unlink(oldPath).catch(() => {
          /* fayl allaqachon yo'q bo'lsa — muammo emas */
        });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: url },
        select: { id: true, fullName: true, avatarUrl: true },
      });

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me/profile — o'z kartochka ma'lumotlari (qisqa ma'lumot va filial).
   * Login/parol bu yerda emas — ular /api/auth/profile da (joriy parol talab qilinadi).
   */
  async updateMyCardProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { bio, filial } = req.body;
      const data: { bio?: string | null; filial?: string | null } = {};

      if (bio !== undefined) {
        if (bio !== null && typeof bio !== 'string') {
          throw ApiError.badRequest("Ma'lumot matn bo'lishi kerak");
        }
        const trimmed = typeof bio === 'string' ? bio.trim() : '';
        if (trimmed.length > 300) {
          throw ApiError.badRequest("Ma'lumot 300 belgidan oshmasligi kerak");
        }
        data.bio = trimmed || null;
      }

      if (filial !== undefined) {
        if (filial === null || filial === '') {
          data.filial = null;
        } else if (!isValidFilial(filial)) {
          throw ApiError.badRequest("Bunday filial yo'q");
        } else {
          data.filial = filial;
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data,
        select: { id: true, fullName: true, avatarUrl: true, bio: true, filial: true },
      });

      res.json({ success: true, data: { ...user, filialLabel: filialLabel(user.filial) } });
    } catch (error) {
      next(error);
    }
  }

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
        excludeRole: req.query.excludeRole as string | undefined,
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
        // IDOR himoyasi: o'quvchi shu o'qituvchining guruhida bo'lishi shart.
        // Aks holda istalgan o'qituvchi begona o'quvchining login/parolini
        // almashtirib, akkauntini egallab olishi mumkin edi.
        const owns = await usersService.isStudentOfTeacher(req.params.id, req.user.userId);
        if (!owns) {
          throw ApiError.forbidden("Bu o'quvchi sizning guruhingizda emas");
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
