import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from './errorHandler';
import prisma from '../../config/database';

export interface JwtPayload {
  userId: string;
  role: string;
  login: string;
  /** Token versiyasi. Eski (bu maydonsiz) tokenlar 0 deb hisoblanadi. */
  tv?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT token tekshirish middleware
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Token topilmadi');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Foydalanuvchi hali ham active ekanligini va tokeni bekor qilinmaganini tekshirish
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Foydalanuvchi faol emas');
    }

    // Token bekor qilinganmi? Parol o'zgarganda yoki "barcha qurilmalardan
    // chiqarish" bosilganda tokenVersion oshadi va eski tokenlar shu yerda
    // to'xtatiladi.
    // Eski (tv maydonisiz) tokenlar 0 deb hisoblanadi — shuning uchun bu
    // o'zgarish deploydan keyin hech kimni tizimdan chiqarib yubormaydi.
    if ((decoded.tv ?? 0) !== user.tokenVersion) {
      throw ApiError.unauthorized('Sessiya tugatilgan — qaytadan kiring');
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Yaroqsiz token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token muddati tugagan'));
    } else {
      next(error);
    }
  }
};

/**
 * Rol tekshirish middleware (authenticate dan keyin ishlatiladi)
 */
export const roleGuard = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Bu amalni bajarish uchun ruxsatingiz yo\'q'));
    }

    next();
  };
};
