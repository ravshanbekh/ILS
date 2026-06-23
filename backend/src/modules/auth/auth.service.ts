import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { ApiError } from '../../shared/middleware/errorHandler';
import { LoginInput } from './auth.validation';
import { JwtPayload } from '../../shared/middleware/auth.middleware';
import logger from '../../shared/utils/logger';

class AuthService {
  /**
   * Login — foydalanuvchini tekshirish va token berish
   */
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { login: data.login },
    });

    if (!user) {
      throw ApiError.unauthorized('Login yoki parol noto\'g\'ri');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Hisobingiz faol emas. Admin bilan bog\'laning.');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Login yoki parol noto\'g\'ri');
    }

    // Token yaratish
    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      login: user.login,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        targetType: 'user',
        targetId: user.id,
        details: { ip: 'logged' },
      },
    });

    logger.info(`User logged in: ${user.login} (${user.role})`);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        login: user.login,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh token orqali yangi access token olish
   */
  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        env.JWT_REFRESH_SECRET
      ) as JwtPayload;

      // Foydalanuvchi hali active ekanligini tekshirish
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, login: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw ApiError.unauthorized('Foydalanuvchi topilmadi yoki faol emas');
      }

      const payload: JwtPayload = {
        userId: user.id,
        role: user.role,
        login: user.login,
      };

      const newAccessToken = this.generateAccessToken(payload);
      const newRefreshToken = this.generateRefreshToken(payload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Refresh token muddati tugagan. Qayta login qiling.');
      }
      throw ApiError.unauthorized('Yaroqsiz refresh token');
    }
  }

  /**
   * Access token yaratish
   */
  private generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Refresh token yaratish
   */
  private generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });
  }
}

export default new AuthService();
