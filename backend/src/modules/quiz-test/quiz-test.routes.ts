import { Router, json } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';
import * as ctrl from './quiz-test.controller';
import * as pub from './quiz-test.public.controller';

const router = Router();

// ── Rasm yuklash ────────────────────────────────────────────────────────────
// `data/` ostida — docker-compose'da faqat shu papka volume.
// uploads/ ga yozilgan fayl har redeploy'da yo'qoladi.
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'quiz-tests');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `qt-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG / PNG / WEBP / GIF rasm yuklanadi'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Ommaviy uchun chegara ───────────────────────────────────────────────────
// Auth yo'q, shuning uchun so'rovlar soni cheklanadi.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // javob saqlash tez-tez bo'ladi, shuning uchun keng
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
});

const startLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20, // bitta IP 10 daqiqada 20 marta test boshlay oladi
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring.' },
});

// ═══════════════════════════════════════════════════════════════════════════
//  OMMAVIY — auth talab qilinmaydi.
//  Diqqat: bu bloklar `/:id` naqshidan OLDIN turishi shart, aks holda
//  "public" so'zi test id sifatida o'qiladi.
// ═══════════════════════════════════════════════════════════════════════════
router.get('/public/:code', publicLimiter, pub.getTestByCode);
router.post('/public/:code/start', startLimiter, json(), pub.startAttempt);
router.get('/attempt/:token', publicLimiter, pub.resumeAttempt);
router.post('/attempt/:token/answer', publicLimiter, json({ limit: '1mb' }), pub.saveAnswer);
router.post('/attempt/:token/submit', publicLimiter, json(), pub.submitAttempt);
router.get('/attempt/:token/result', publicLimiter, pub.getAttemptResult);

// ═══════════════════════════════════════════════════════════════════════════
//  MENTOR — auth kerak.
//  `quiz_tests` ruxsati: admin va teacher'da sukut bo'yicha bor
//  (permissions.ts dagi legacyRoles), boshqalarga qo'lda beriladi.
// ═══════════════════════════════════════════════════════════════════════════
// roleGuard rolni, permissionGuard esa shaxsni tekshiradi.
// `quiz_tests` legacyRoles: teacher + assistant — ular avvalgidek ishlaydi,
// boshqa rolga admin qo'lda ruxsat beradi.
const mentor = [
  authenticate,
  roleGuard('admin', 'teacher', 'assistant', 'administrator', 'filial_rahbari', 'nazoratchi'),
  permissionGuard('quiz_tests'),
];

router.post('/', ...mentor, json(), ctrl.createTest);
router.get('/', ...mentor, ctrl.getMyTests);

router.get('/:id', ...mentor, ctrl.getTestById);
router.patch('/:id', ...mentor, json(), ctrl.updateTest);
router.delete('/:id', ...mentor, ctrl.deleteTest);
router.post('/:id/duplicate', ...mentor, ctrl.duplicateTest);
router.get('/:id/preview', ...mentor, ctrl.previewTest);

// Savollar
router.post('/:id/questions', ...mentor, upload.single('image'), ctrl.addQuestion);
router.post('/:id/questions/bulk', ...mentor, json({ limit: '8mb' }), ctrl.bulkAddQuestions);
router.patch('/:id/questions/reorder', ...mentor, json(), ctrl.reorderQuestions);
router.patch('/:id/questions/:qId', ...mentor, upload.single('image'), ctrl.updateQuestion);
router.delete('/:id/questions/:qId', ...mentor, ctrl.deleteQuestion);

// Natijalar
router.get('/:id/results', ...mentor, ctrl.getResults);
router.get('/:id/attempts/:attemptId', ...mentor, ctrl.getAttemptDetail);
router.delete('/:id/attempts/:attemptId', ...mentor, ctrl.deleteAttempt);
router.patch('/:id/answers/:answerId/review', ...mentor, json(), ctrl.reviewAnswer);

export default router;
