import { Router } from 'express';
import { requireAuth, requireActive, requireRole } from '../middleware/auth.js';
import * as tc from '../controllers/teacher.js';

const router = Router();
const guard = [requireAuth, requireActive, requireRole('teacher')];

router.get('/subjects',              ...guard, tc.getSubjects);
router.post('/sessions/open',        ...guard, tc.openSession);
router.get('/sessions/active',       ...guard, tc.getActiveSessions);
router.get('/sessions/recent',       ...guard, tc.getRecentSessions);
router.get('/sessions/:id/live',     ...guard, tc.getLiveAttendance);
router.post('/sessions/:id/close',   ...guard, tc.closeSession);
router.patch('/attendance/:log_id',  ...guard, tc.overrideAttendance);
router.get('/reports/:subject_id',   ...guard, tc.getSubjectReport);
router.post('/messages',             ...guard, tc.sendMessage);

router.get('/timetable',                         ...guard, tc.getTimetable);
router.post('/marks',                            ...guard, tc.uploadMarks);
router.get('/marks/:subject_id',                 ...guard, tc.getMarksForSubject);
router.patch('/marks/:id',                       ...guard, tc.editMark);
router.get('/students/:subject_id',              ...guard, tc.getStudentPerformance);
router.post('/attendance/manual',                ...guard, tc.markAttendanceManual);
router.get('/reports/defaulters/:subject_id',    ...guard, tc.getDefaulters);
router.get('/leave-requests',                    ...guard, tc.getLeaveRequestsForMySubjects);
router.patch('/leave-requests/:id',              ...guard, tc.reviewLeaveRequest);
router.post('/attendance-corrections',           ...guard, tc.requestAttendanceCorrection);
router.get('/attendance-corrections',            ...guard, tc.getMyCorrectionRequests);

router.get('/academic-years',                    ...guard, tc.getAcademicYears);
router.get('/mentors',                           ...guard, tc.getMentors);
router.post('/students/:student_id/mentor',      ...guard, tc.assignMentorToStudent);

export default router;
