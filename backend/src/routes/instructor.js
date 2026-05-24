import { Router } from 'express';
import { requireAuth, requireActive, requireRole } from '../middleware/auth.js';
import * as instrCtrl from '../controllers/instructor.js';

const router = Router();
const guard = [requireAuth, requireActive, requireRole('instructor')];

router.get('/subjects', ...guard, instrCtrl.getSubjects);
router.post('/sessions/open', ...guard, instrCtrl.openSession);
router.get('/sessions/:id/live', ...guard, instrCtrl.getLiveAttendance);
router.post('/sessions/:id/close', ...guard, instrCtrl.closeSession);
router.patch('/attendance/:log_id', ...guard, instrCtrl.overrideAttendance);
router.get('/reports/:subject_id', ...guard, instrCtrl.getSubjectReport);
router.post('/messages', ...guard, instrCtrl.sendMessage);

export default router;
