import { Router } from 'express';
import categoriesController from './categories.controller';
import { protect, restrictTo } from '../../shared/middleware/auth';

const router = Router();

// Barcha uchun
router.use(protect);

router.get('/', categoriesController.getAll);

// Faqat admin uchun
router.use(restrictTo('admin'));

router.post('/', categoriesController.create);
router.put('/:id', categoriesController.update);
router.delete('/:id', categoriesController.delete);

export default router;
