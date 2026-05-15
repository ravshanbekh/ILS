import { Router } from 'express';
import categoriesController from './categories.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

// Barcha uchun
router.use(authenticate);

router.get('/', categoriesController.getAll);

// Faqat admin uchun
router.use(roleGuard('admin'));

router.post('/', categoriesController.create);
router.put('/:id', categoriesController.update);
router.delete('/:id', categoriesController.delete);

export default router;
