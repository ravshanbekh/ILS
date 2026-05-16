import { Router } from 'express';
import groupsController from './groups.controller';
import normativesController from '../normatives/normatives.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

// Barcha routelar authenticate talab qiladi
router.use(authenticate);

// GET /api/groups — Barcha guruhlar (admin va teacher)
router.get('/', roleGuard('admin', 'teacher'), groupsController.getAll);

// GET /api/groups/:id — Bitta guruh (o'quvchilar ham o'z guruhini ko'rishi uchun)
router.get('/:id', roleGuard('admin', 'teacher', 'student'), groupsController.getById);

// POST /api/groups — Guruh yaratish
router.post('/', roleGuard('admin', 'teacher'), groupsController.create);

// PUT /api/groups/:id — Guruhni yangilash
router.put('/:id', roleGuard('admin', 'teacher'), groupsController.update);

// DELETE /api/groups/:id — Guruhni o'chirish
router.delete('/:id', roleGuard('admin'), groupsController.delete);

// POST /api/groups/:id/students — O'quvchi qo'shish
router.post('/:id/students', roleGuard('admin', 'teacher'), groupsController.addStudent);

// POST /api/groups/:id/students/bulk — Ko'plab o'quvchi qo'shish
router.post('/:id/students/bulk', roleGuard('admin', 'teacher'), groupsController.addStudents);

// DELETE /api/groups/:id/students/:studentId — O'quvchini chiqarish
router.delete('/:id/students/:studentId', roleGuard('admin', 'teacher'), groupsController.removeStudent);

// POST /api/groups/:id/normatives — Guruhga normativ biriktirish
router.post('/:id/normatives', roleGuard('admin', 'teacher'), normativesController.assignToGroup);

export default router;
