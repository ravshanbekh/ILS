import { Router } from 'express';
import coinsController from './coins.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();
router.use(authenticate);

// Balans va tarix — o'zi/o'z guruhi/hammasi (aniq tekshiruv controllerda)
router.get('/balance/:studentId', coinsController.getBalance);
router.get('/history/:studentId', coinsController.getHistory);

// Nazorat — "coin_oversight" ruxsati bo'lganlar (admin har doim)
router.get('/teacher-stats', permissionGuard('coin_oversight'), coinsController.getTeacherStats);
router.get('/student-stats', permissionGuard('coin_oversight'), coinsController.getStudentStats);
router.get('/teacher-breakdown/:teacherId', permissionGuard('coin_oversight'), coinsController.getTeacherBreakdown);

// Kunlik chegara sozlamasi
router.get('/settings', permissionGuard('coin_oversight'), coinsController.getSettings);
router.put('/settings', permissionGuard('coin_settings'), coinsController.updateSettings);

export default router;
