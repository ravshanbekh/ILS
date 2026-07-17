import { Router, json } from 'express';
import backupController from './backup.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

// Zaxira nusxalar faqat Admin uchun!
router.use(authenticate);
router.use(roleGuard('admin'));

// GET /api/backup/download
router.get('/download', backupController.downloadBackup);

// POST /api/backup/restore — butun baza JSON qilib yuboriladi, global 2mb limit yetmaydi
router.post('/restore', json({ limit: '100mb' }), backupController.restoreBackup);

export default router;
