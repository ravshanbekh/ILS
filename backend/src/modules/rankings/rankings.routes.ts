import { Router } from 'express';
import rankingsController from './rankings.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/rankings/overall — Umumiy reyting (barcha rollar)
router.get('/overall', rankingsController.getOverall);

// GET /api/rankings/group/:id — Guruh reytingi (barcha rollar)
router.get('/group/:id', rankingsController.getGroupRanking);

// GET /api/rankings/categories — past/o'rtacha/yuqori (o'qituvchi o'zinikini, admin hammasini)
router.get('/categories', rankingsController.getCategories);

export default router;
