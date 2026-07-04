import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import * as examController from './exam.controller';
import * as examGradeController from './exam.grade.controller';


const router = Router();

// ── O'qituvchi tomonidan (Auth kerak) ─────────────────────
// Imtihon CRUD
router.post('/', authenticate, examController.createExam);
router.get('/', authenticate, examController.getMyExams);
router.get('/:id', authenticate, examController.getExamById);
router.patch('/:id/activate', authenticate, examController.activateExam);
router.patch('/:id/complete', authenticate, examController.completeExam);
router.delete('/:id', authenticate, examController.deleteExam);

// Savollar (qo'lda + Excel import)
router.post('/:id/questions', authenticate, examController.addQuestions);
router.post('/:id/questions/bulk', authenticate, examController.bulkAddQuestions);
router.delete('/:id/questions/:qId', authenticate, examController.deleteQuestion);

// Natijalar — o'qituvchi uchun
router.get('/:id/results', authenticate, examController.getExamResults);
router.patch('/:id/grade/:participantId', authenticate, examGradeController.gradeParticipant);

// ── O'quvchi tomonidan (Public — faqat accessCode kerak) ──
router.get('/join/:code', examController.getExamByCode);
router.post('/join/:code/start', examController.startExam);
router.post('/join/:code/submit-test', examController.submitTest);
router.post('/join/:code/submit-videos', examController.submitVideos);

export default router;
