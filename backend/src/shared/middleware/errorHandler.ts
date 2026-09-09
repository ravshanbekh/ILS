import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  // 500 (kutilmagan/ichki) xatolarda haqiqiy xabar (masalan Prisma xato matni) mijozga chiqarilmaydi —
  // faqat operatsion deb belgilangan yoki 5xx bo'lmagan xatolarning xabari ko'rsatiladi.
  const exposeMessage = statusCode < 500 || err.isOperational === true;
  const message = exposeMessage && err.message ? err.message : 'Ichki server xatosi';

  logger.error(`${statusCode} - ${err.message || message}`, {
    method: req.method,
    url: req.url,
    stack: err.stack,
  });

  // Stack trace'ni mijozga faqat ATAY yoqilganda (DEBUG_ERRORS=true) chiqaramiz.
  // Ilgari bu NODE_ENV === 'development' ga bog'liq edi; server esa xatolik bilan
  // development rejimida ishlab turgani uchun stack trace'lar tashqariga oqib
  // chiqardi. Endi NODE_ENV qanday bo'lishidan qat'i nazar, faqat ochiq flag kerak.
  const exposeStack = process.env.DEBUG_ERRORS === 'true';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(exposeStack && { stack: err.stack }),
    },
  });
};

// Custom error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Avtorizatsiya talab qilinadi') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Ruxsat berilmagan') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Topilmadi') {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static internal(message = 'Ichki server xatosi') {
    return new ApiError(500, message, false);
  }
}
