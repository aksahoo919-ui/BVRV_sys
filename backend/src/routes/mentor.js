import { Router } from 'express';
import { requireAuth, requireActive, requireRole } from '../middleware/auth.js';
import * as mc from '../controllers/mentor.js';

const router = Router();
const guard = [requireAuth, requireActive, requireRole('mentor')];

router.get('/students',                    ...guard, mc.getAssignedStudents);
router.get('/students/:student_id',        ...guard, mc.getStudentSummary);

// Student detail tabs
router.get('/students/:student_id/overview',       ...guard, mc.getStudentOverview);
router.get('/students/:student_id/attendance',     ...guard, mc.getStudentAttendanceDetail);
router.get('/students/:student_id/marks',          ...guard, mc.getStudentMarksDetail);
router.get('/students/:student_id/counseling',     ...guard, mc.getStudentCounseling);
router.post('/students/:student_id/counseling',    ...guard, mc.addStudentCounseling);
router.get('/students/:student_id/contacts',       ...guard, mc.getStudentContacts);
router.post('/students/:student_id/contacts',      ...guard, mc.addStudentContact);
router.delete('/students/:student_id/contacts/:contact_id', ...guard, mc.deleteStudentContact);
router.get('/students/:student_id/leave-requests', ...guard, mc.getStudentLeaveRequests);

router.get('/counseling-notes',            ...guard, mc.getCounselingNotes);
router.post('/counseling-notes',           ...guard, mc.createCounselingNote);
router.patch('/counseling-notes/:id',      ...guard, mc.updateCounselingNote);
router.delete('/counseling-notes/:id',     ...guard, mc.deleteCounselingNote);

router.get('/parent-contacts',             ...guard, mc.getParentContacts);
router.post('/parent-contacts',            ...guard, mc.createParentContact);

router.get('/meetings',                    ...guard, mc.getMeetings);
router.post('/meetings',                   ...guard, mc.createMeeting);
router.patch('/meetings/:id',              ...guard, mc.updateMeeting);

router.get('/alerts',                      ...guard, mc.getAlerts);
router.post('/messages',                   ...guard, mc.sendMentorMessage);

// Mentor weekly classes + manual attendance
router.get('/subjects',                       ...guard, mc.getMentorSubjects);
router.get('/subjects/:subject_id/students',  ...guard, mc.getMentorSubjectStudents);
router.get('/sessions',                       ...guard, mc.getMentorSessions);
router.post('/sessions',                      ...guard, mc.createMentorSession);
router.post('/sessions/open-code',            ...guard, mc.openMentorCodeSession);
router.post('/sessions/:id/close',            ...guard, mc.closeMentorCodeSession);
router.get('/sessions/:id/attendance',        ...guard, mc.getMentorSessionAttendance);
router.post('/sessions/:id/attendance',       ...guard, mc.markMentorAttendance);
router.get('/defaulters',                     ...guard, mc.getMentorDefaulters);

export default router;
