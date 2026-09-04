import { Router } from 'express';
import coinsController from './coins.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Balans va tarix — o'zi/o'z guruhi/hammasi (aniq tekshiruv controllerda)
router.get('/balance/:studentId', coinsController.getBalance);
router.get('/history/:studentId', coinsController.getHistory);

// Admin/kassir — o'qituvchilar bo'yicha nazorat
router.get('/teacher-stats', roleGuard('admin', 'kassir'), coinsController.getTeacherStats);

// Kunlik chegara sozlamasi
router.get('/settings', roleGuard('admin', 'kassir'), coinsController.getSettings);
router.put('/settings', roleGuard('admin'), coinsController.updateSettings);

export default router;
