import { Router, json } from 'express';
import backupController from './backup.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { heavyLimiter } from '../../shared/middleware/rateLimiter';

const router = Router();

// Zaxira nusxalar faqat Admin uchun!
router.use(authenticate);
router.use(roleGuard('admin'));

// GET /api/backup/download
router.get('/download', heavyLimiter, backupController.downloadBackup);

// POST /api/backup/restore — butun baza JSON qilib yuboriladi, global 2mb limit yetmaydi
router.post('/restore', heavyLimiter, json({ limit: '100mb' }), backupController.restoreBackup);

export default router;
