import { Router } from 'express';
import { requireAuth, requireActive, requireRole } from '../middleware/auth.js';
import * as sc from '../controllers/student.js';

const router = Router();
const guard = [requireAuth, requireActive, requireRole('student')];

// Existing
router.get('/subjects',                          ...guard, sc.getSubjects);
router.get('/settings',                          ...guard, sc.getStudentSettings);
router.get('/attendance/today',                  ...guard, sc.getTodayAttendance);
router.post('/attendance/submit',                ...guard, sc.submitAttendance);
router.get('/attendance',                        ...guard, sc.getAttendanceSummary);
router.get('/messages',                          ...guard, sc.getMessages);
router.patch('/messages/:id/read',               ...guard, sc.markRead);

// Existing extended
router.get('/marks',                             ...guard, sc.getMarks);
router.get('/results',                           ...guard, sc.getResults);
router.get('/results/:semester_id/report-card',  ...guard, sc.getMyReportCard);
router.post('/leave-requests',                   ...guard, sc.submitLeaveRequest);
router.get('/leave-requests',                    ...guard, sc.getMyLeaveRequests);
router.get('/meetings',                          ...guard, sc.getMyMeetings);
router.get('/notifications',                     ...guard, sc.getNotifications);
router.patch('/notifications/:id/read',          ...guard, sc.markNotificationRead);

// New
router.get('/timetable',                         ...guard, sc.getTimetable);
router.get('/marks-memo/:semester_id',           ...guard, sc.getMarksMemo);
router.get('/profile',                           ...guard, sc.getProfile);
router.patch('/profile',                         ...guard, sc.updateProfile);
router.get('/mentor',                            ...guard, sc.getMyMentor);

export default router;
