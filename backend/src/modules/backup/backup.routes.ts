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

// POST /api/backup/inspect — faylni tekshiradi, hech narsa o'zgartirmaydi.
// Tiklashdan OLDIN shu chaqirilishi kerak: qaysi jadvallar yo'q, qancha
// ma'lumot yo'qoladi — hammasi shu yerda ko'rinadi.
router.post('/inspect', heavyLimiter, json({ limit: '200mb' }), backupController.inspectBackup);

// POST /api/backup/restore — butun baza JSON qilib yuboriladi, global 2mb limit yetmaydi.
// Endi 48 ta jadval ham kelgani uchun 100mb ba'zan yetmaydi.
router.post('/restore', heavyLimiter, json({ limit: '200mb' }), backupController.restoreBackup);

export default router;
