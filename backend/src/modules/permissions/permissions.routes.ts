import { Router } from 'express';
import permissionsController from './permissions.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Har bir foydalanuvchi o'z ruxsatlarini bilishi kerak (frontend tugmalarni shunga qarab ko'rsatadi)
router.get('/me', permissionsController.getMine);

// Boshqarish — faqat admin
router.get('/catalog', roleGuard('admin'), permissionsController.getCatalog);
router.get('/users', roleGuard('admin'), permissionsController.listUsers);
router.put('/users/:id', roleGuard('admin'), permissionsController.setUserPermissions);

export default router;
