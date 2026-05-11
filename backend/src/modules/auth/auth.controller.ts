import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import { loginSchema, refreshTokenSchema } from './auth.validation';
import { ApiError } from '../../shared/middleware/errorHandler';
import prisma from '../../config/database';

class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await authService.login(validated.data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = refreshTokenSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest('Refresh token talab qilinadi');
      }

      const result = await authService.refreshToken(validated.data.refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Stateless JWT — client tomonda token o'chirish kifoya
      // Redis bo'lsa blacklist qo'shish mumkin
      res.json({
        success: true,
        message: 'Muvaffaqiyatli chiqildi',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me — Joriy foydalanuvchi ma'lumotlari
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw ApiError.unauthorized();
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          fullName: true,
          login: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          groupStudents: {
            include: {
              group: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!user) {
        throw ApiError.notFound('Foydalanuvchi topilmadi');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
