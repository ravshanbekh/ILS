import { Router } from 'express';
import monitoringController from './monitoring.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'administrator', 'sotuv_operatori', 'call_operatori', 'filial_rahbari'] as const;

// ─── GURUHLAR RO'YXATI ──────────────────────────────────────
// GET /api/monitoring/groups
router.get('/groups', roleGuard(...ALLOWED_ROLES), monitoringController.getGroupsList);

// ─── GURUH DASHBOARD ────────────────────────────────────────
// GET /api/monitoring/groups/:groupId
router.get('/groups/:groupId', roleGuard(...ALLOWED_ROLES), monitoringController.getGroupDashboard);

// ─── GURUH QO'NG'IROQLAR TARIXI ─────────────────────────────
// GET /api/monitoring/groups/:groupId/calls
router.get('/groups/:groupId/calls', roleGuard(...ALLOWED_ROLES), monitoringController.getGroupCalls);

// ─── GURUH AI TAHLIL ────────────────────────────────────────
// POST /api/monitoring/groups/:groupId/ai-analyze
router.post('/groups/:groupId/ai-analyze', roleGuard(...ALLOWED_ROLES), monitoringController.analyzeGroup);

// ─── O'QITUVCHI AI TAHLIL ───────────────────────────────────
// POST /api/monitoring/teachers/:teacherId/ai-analyze
router.post('/teachers/:teacherId/ai-analyze', roleGuard(...ALLOWED_ROLES), monitoringController.analyzeTeacher);

// ─── O'QUVCHI TIMELINE ──────────────────────────────────────
// GET /api/monitoring/students/:studentId/timeline
router.get('/students/:studentId/timeline', roleGuard(...ALLOWED_ROLES), monitoringController.getStudentTimeline);

// ─── O'QUVCHI SCRIPT ────────────────────────────────────────
// POST /api/monitoring/students/:id/script
router.post('/students/:id/script', roleGuard(...ALLOWED_ROLES), monitoringController.generateStudentScript);

// ─── CALL CRUD ──────────────────────────────────────────────
// POST /api/monitoring/calls
router.post('/calls', roleGuard(...ALLOWED_ROLES), monitoringController.createCall);

// DELETE /api/monitoring/calls/:callId
router.delete('/calls/:callId', roleGuard('admin', 'administrator'), monitoringController.deleteCall);

// ─── NOTE CRUD ──────────────────────────────────────────────
// POST /api/monitoring/calls/:callId/notes
router.post('/calls/:callId/notes', roleGuard(...ALLOWED_ROLES), monitoringController.addNote);

// PUT /api/monitoring/notes/:noteId
router.put('/notes/:noteId', roleGuard(...ALLOWED_ROLES), monitoringController.updateNote);

// DELETE /api/monitoring/notes/:noteId
router.delete('/notes/:noteId', roleGuard(...ALLOWED_ROLES), monitoringController.deleteNote);

export default router;
