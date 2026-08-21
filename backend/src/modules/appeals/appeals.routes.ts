import { Router } from 'express';
import appealsController from './appeals.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

const VIEWER_ROLES = ['admin', 'teacher', 'filial_rahbari', 'administrator'];

router.get('/', roleGuard(...VIEWER_ROLES), appealsController.getAll);
router.get('/export', roleGuard(...VIEWER_ROLES), appealsController.exportExcel);
router.get('/:id', roleGuard(...VIEWER_ROLES), appealsController.getById);
router.patch('/:id/reply', roleGuard(...VIEWER_ROLES), appealsController.reply);
router.patch('/:id/status', roleGuard(...VIEWER_ROLES), appealsController.updateStatus);

export default router;
