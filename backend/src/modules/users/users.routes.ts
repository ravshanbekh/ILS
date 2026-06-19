import { Router } from 'express';
import usersController from './users.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

// Barcha routelar authenticate talab qiladi
router.use(authenticate);

// GET /api/users/ungrouped — Guruhsiz o'quvchilar
router.get('/ungrouped', roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'teacher'), usersController.getUngrouped);

// GET /api/users/my-students — Teacher o'z o'quvchilarini tezkor oladi (bitta query)
router.get('/my-students', roleGuard('teacher'), usersController.getMyStudents);

// GET /api/users — Barcha foydalanuvchilar
router.get('/', roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'teacher'), usersController.getAll);

// GET /api/users/:id — Bitta foydalanuvchi
router.get('/:id', roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'teacher'), usersController.getById);

// POST /api/users/bulk — Ko'p foydalanuvchi yaratish (bulk import)
router.post('/bulk', roleGuard('admin', 'teacher'), usersController.bulkCreate);

// POST /api/users — Yangi foydalanuvchi yaratish (admin yoki teacher)
router.post('/', roleGuard('admin', 'teacher'), usersController.create);

// PUT /api/users/:id — Yangilash (admin yoki teacher)
router.put('/:id', roleGuard('admin', 'teacher'), usersController.update);

// DELETE /api/users/:id — O'chirish (faqat admin)
router.delete('/:id', roleGuard('admin'), usersController.delete);

export default router;
