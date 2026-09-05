import { Router, json } from 'express';
import usersController from './users.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();

// Barcha routelar authenticate talab qiladi
router.use(authenticate);

const VIEWER_ROLES = ['admin', 'administrator', 'sotuv_operatori', 'kassir', 'teacher', 'filial_rahbari', 'moliya_rahbari', 'assistant', 'nazoratchi', 'hr_rahbari', 'call_operatori'];

// GET /api/users/ungrouped — Guruhsiz o'quvchilar
router.get('/ungrouped', roleGuard(...VIEWER_ROLES), usersController.getUngrouped);

// GET /api/users/my-students — Teacher o'z o'quvchilarini tezkor oladi (bitta query)
router.get('/my-students', roleGuard('teacher'), usersController.getMyStudents);

// GET /api/users — Barcha foydalanuvchilar
router.get('/', roleGuard(...VIEWER_ROLES), usersController.getAll);

// GET /api/users/:id — Bitta foydalanuvchi
router.get('/:id', roleGuard(...VIEWER_ROLES), usersController.getById);

// POST /api/users/bulk — Ko'p foydalanuvchi yaratish (bulk import, Excel'dan yuzlab qator kelishi mumkin)
router.post('/bulk', roleGuard('admin', 'teacher'), permissionGuard('bulk_import_students'), json({ limit: '5mb' }), usersController.bulkCreate);

// POST /api/users — Yangi foydalanuvchi yaratish (admin yoki teacher)
router.post('/', roleGuard('admin', 'teacher'), permissionGuard('create_student'), usersController.create);

// PUT /api/users/:id — Yangilash (admin yoki teacher)
router.put('/:id', roleGuard('admin', 'teacher'), usersController.update);

// DELETE /api/users/:id — O'chirish (faqat admin)
router.delete('/:id', roleGuard('admin'), usersController.delete);

export default router;
