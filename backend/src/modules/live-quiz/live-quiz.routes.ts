import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import * as quizController from './live-quiz.controller';

const router = Router();

// ── O'qituvchi ──────────────────────────────────────────────
router.post('/', authenticate, quizController.createQuiz);
router.get('/', authenticate, quizController.getMyQuizzes);
router.get('/:id', authenticate, quizController.getQuizById);
router.post('/:id/questions', authenticate, quizController.addQuestions);
router.post('/:id/questions/bulk', authenticate, quizController.bulkAddQuestions);
router.delete('/:id/questions/:qId', authenticate, quizController.deleteQuestion);
router.patch('/:id/start', authenticate, quizController.startQuiz);
router.patch('/:id/next', authenticate, quizController.nextQuestion);
router.patch('/:id/finish', authenticate, quizController.finishQuiz);
router.get('/:id/stats', authenticate, quizController.getQuizStats);

// ── O'yinchi (Public) ────────────────────────────────────────
router.get('/join/:code', quizController.getQuizByCode);
router.post('/join/:code/enter', quizController.joinQuiz);
router.post('/answer', quizController.submitAnswer);

export default router;
