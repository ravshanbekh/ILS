import { Router, json } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { permissionGuard, staffOnly } from '../../shared/middleware/permission.middleware';
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
//
// DIQQAT: test odatda sinfda o'tkaziladi — 30 ta o'quvchi BITTA Wi-Fi'dan,
// ya'ni bitta IP'dan kiradi. Ilgari hamma chegara IP bo'yicha edi: start
// 10 daqiqada 20 ta (21-o'quvchi testni boshlay olmasdi), javob saqlash esa
// butun sinf uchun daqiqasiga 120 ta — 429 olgan javob saqlanmay qolardi.
// Endi chegara “bitta odam”ni sanaydi: urinish token bo'yicha, start —
// IP + test + ism bo'yicha; IP bo'yicha faqat keng spam-to'siq qoladi.
// (Umumiy apiLimiter bu yo'llarni rateLimiter.ts da o'tkazib yuboradi.)
const pageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // test sahifasini ochish — butun sinf bitta IP'dan
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
});

const attemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // BITTA ishtirokchi uchun daqiqasiga 120 so'rov — odam bundan tez bosmaydi
  keyGenerator: (req) => `qt-attempt:${req.params.token}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
});

const startPersonLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10, // bitta odam (IP + test + ism) 10 daqiqada 10 marta boshlay oladi
  keyGenerator: (req) => {
    const name = String(req.body?.fullName ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    return `qt-start:${req.ip}:${req.params.code}:${name}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring.' },
});

const startIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200, // bitta IP (bir nechta sinf) 10 daqiqada 200 ta start — spamga to'siq
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring.' },
});

// ═══════════════════════════════════════════════════════════════════════════
//  OMMAVIY — auth talab qilinmaydi.
//  Diqqat: bu bloklar `/:id` naqshidan OLDIN turishi shart, aks holda
//  "public" so'zi test id sifatida o'qiladi.
// ═══════════════════════════════════════════════════════════════════════════
router.get('/public/:code', pageLimiter, pub.getTestByCode);
// startPersonLimiter kaliti ismni req.body dan oladi — shuning uchun json() dan keyin
router.post('/public/:code/start', startIpLimiter, json(), startPersonLimiter, pub.startAttempt);
router.get('/attempt/:token', attemptLimiter, pub.resumeAttempt);
router.post('/attempt/:token/answer', attemptLimiter, json({ limit: '1mb' }), pub.saveAnswer);
router.post('/attempt/:token/submit', attemptLimiter, json(), pub.submitAttempt);
router.get('/attempt/:token/result', attemptLimiter, pub.getAttemptResult);

// ═══════════════════════════════════════════════════════════════════════════
//  MENTOR — auth kerak.
//  `quiz_tests` ruxsati: admin va teacher'da sukut bo'yicha bor
//  (permissions.ts dagi legacyRoles), boshqalarga qo'lda beriladi.
// ═══════════════════════════════════════════════════════════════════════════
// `quiz_tests` legacyRoles: teacher + assistant — ular avvalgidek ishlaydi,
// boshqa rolga admin qo'lda ruxsat beradi.
// Rol ro'yxati o'rniga staffOnly: ruxsat berilgan HAR QANDAY xodim (kassir,
// HR va h.k.) ishlay oladi — ilgari ro'yxatda yo'q rolga ruxsat yoqilsa
// ham 403 olardi. O'quvchiga baribir yopiq.
const mentor = [
  authenticate,
  staffOnly,
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
router.get('/:id/results/export', ...mentor, ctrl.exportResultsExcel);
router.get('/:id/attempts/:attemptId', ...mentor, ctrl.getAttemptDetail);
router.delete('/:id/attempts/:attemptId', ...mentor, ctrl.deleteAttempt);
router.patch('/:id/answers/:answerId/review', ...mentor, json(), ctrl.reviewAnswer);

export default router;
