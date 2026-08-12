import { Router } from 'express';
import trashController from './trash.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'administrator', 'filial_rahbari'] as const;

// GET /api/trash/groups
router.get('/groups', roleGuard(...ALLOWED_ROLES), trashController.getTrashGroups);

// GET /api/trash/users
router.get('/users', roleGuard(...ALLOWED_ROLES), trashController.getTrashUsers);

// POST /api/trash/groups/:id/restore
router.post('/groups/:id/restore', roleGuard(...ALLOWED_ROLES), trashController.restoreGroup);

// POST /api/trash/users/:id/restore
router.post('/users/:id/restore', roleGuard(...ALLOWED_ROLES), trashController.restoreUser);

// DELETE /api/trash/groups/:id/permanent
router.delete('/groups/:id/permanent', roleGuard('admin'), trashController.permanentlyDeleteGroup);

// DELETE /api/trash/users/:id/permanent
router.delete('/users/:id/permanent', roleGuard('admin'), trashController.permanentlyDeleteUser);

// DELETE /api/trash/empty
router.delete('/empty', roleGuard('admin'), trashController.emptyTrash);

export default router;
