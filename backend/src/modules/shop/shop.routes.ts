import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import shopController from './shop.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();
router.use(authenticate);

// data/ ostida — docker-compose'da shu papka persistent volume (backend_data), uploads/ emas
// (qarang: live-quiz.routes.ts / exam.routes.ts dagi xuddi shunday izoh).
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'shop-items');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `shop-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG/PNG/WEBP rasm yuklanadi'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ── Tovarlar ──────────────────────────────────────────────────────────────────
// Ko'rish hammaga ochiq (o'quvchi do'konni ko'rishi kerak), o'zgartirish — ruxsat bilan
router.get('/items', shopController.getItems); // admin — hammasi, boshqalar — faqat faol
router.post('/items', permissionGuard('shop_manage'), upload.single('image'), shopController.createItem);
router.put('/items/:id', permissionGuard('shop_manage'), upload.single('image'), shopController.updateItem);
router.delete('/items/:id', permissionGuard('shop_manage'), shopController.deleteItem);

// ── Buyurtmalar ───────────────────────────────────────────────────────────────
router.post('/orders', roleGuard('student'), shopController.createOrder);
router.get('/orders/mine', roleGuard('student'), shopController.getMyOrders);
router.get('/orders', permissionGuard('shop_orders'), shopController.listOrders);
router.patch('/orders/:id/fulfill', permissionGuard('shop_orders'), shopController.fulfillOrder);
router.patch('/orders/:id/cancel', permissionGuard('shop_orders'), shopController.cancelOrder);

export default router;
