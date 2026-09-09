import { Router } from 'express';
import eventFeedbackController from './event-feedback.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { aiLimiter } from '../../shared/middleware/rateLimiter';

const router = Router();
router.use(authenticate);

const VIEWER_ROLES = ['admin', 'teacher', 'filial_rahbari', 'administrator'];

router.get('/', roleGuard(...VIEWER_ROLES), eventFeedbackController.getAll);
router.get('/stats', roleGuard(...VIEWER_ROLES), eventFeedbackController.getStats);
router.get('/ai-analyze', aiLimiter, roleGuard(...VIEWER_ROLES), eventFeedbackController.aiAnalyze);

export default router;
