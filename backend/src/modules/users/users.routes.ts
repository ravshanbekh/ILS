import { Router, json } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import usersController from './users.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();

// Barcha routelar authenticate talab qiladi
router.use(authenticate);

// ── Avatar yuklash ────────────────────────────────────────────────────────────
// data/ ostida — docker-compose'da faqat shu papka persistent volume.
// Tashqarisiga yozilsa, har deployda rasmlar o'chib ketardi (bu xato ilgari
// quiz musiqasida bo'lgan).
const avatarDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `avatar-${req.user!.userId}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG/PNG/WEBP rasm yuklanadi'));
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB — profil rasmi uchun yetarli
});

// POST /api/users/me/avatar — o'z rasmini yuklash
router.post('/me/avatar', avatarUpload.single('avatar'), usersController.uploadMyAvatar);

// PATCH /api/users/me/profile — o'z kartochka ma'lumotlari (bio, filial)
router.patch('/me/profile', usersController.updateMyCardProfile);

// POST /api/users/force-logout-all — hammasini birdan chiqarish (faqat admin)
// :id li yo'ldan OLDIN turishi kerak emas (yo'llar farq qiladi), lekin
// o'qilishi uchun yonma-yon turadi.
router.post('/force-logout-all', roleGuard('admin'), usersController.forceLogoutAll);

// POST /api/users/:id/force-logout — barcha qurilmalardan chiqarish (faqat admin)
router.post('/:id/force-logout', roleGuard('admin'), usersController.forceLogout);

// GET /api/users/filials — filiallar ro'yxati (yagona manba: constants/filials.ts)
router.get('/filials', usersController.getFilials);

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
