import { Router } from 'express';
import authController from './auth.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { loginLimiter } from '../../shared/middleware/rateLimiter';

const router = Router();

// POST /api/auth/login — Login (rate limited)
router.post('/login', loginLimiter, authController.login);

// POST /api/auth/refresh — Token yangilash
router.post('/refresh', authController.refresh);

// POST /api/auth/logout — Chiqish
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me — Joriy foydalanuvchi
router.get('/me', authenticate, authController.getMe);

// PATCH /api/auth/profile — O'z login/parolini o'zgartirish
router.patch('/profile', authenticate, authController.updateProfile);

export default router;
