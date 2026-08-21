import { Router } from 'express';
import groupEventsController from './group-events.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', roleGuard('admin', 'teacher'), groupEventsController.create);
router.get('/', roleGuard('admin', 'teacher'), groupEventsController.getByGroup);
router.get('/:id/rsvp-summary', roleGuard('admin', 'teacher'), groupEventsController.getRsvpSummary);
router.delete('/:id', roleGuard('admin', 'teacher'), groupEventsController.delete);

export default router;
