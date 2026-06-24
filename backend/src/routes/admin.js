import { Router } from 'express';
import { requireAuth, requireActive, requireRole } from '../middleware/auth.js';
import * as adminCtrl from '../controllers/admin.js';
import * as acad from '../controllers/adminAcademic.js';
import * as ops from '../controllers/adminOperations.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
const guard = [requireAuth, requireActive, requireRole('admin')];

// ── Users ─────────────────────────────────────────────────────────────────
router.get('/pending-users', ...guard, adminCtrl.getPendingUsers);
router.patch('/users/:id/approve',  ...guard, adminCtrl.approveUser);
router.patch('/users/:id/reject',   ...guard, adminCtrl.rejectUser);
router.patch('/users/:id/suspend',  ...guard, adminCtrl.suspendUser);
router.patch('/users/:id/email',          ...guard, adminCtrl.updateUserEmail);
router.patch('/users/:id/secondary-role', ...guard, adminCtrl.setSecondaryRole);
router.patch('/users/:id/reset-password', ...guard, adminCtrl.resetPassword);
router.delete('/users/:id',         ...guard, adminCtrl.deleteUser);
router.get('/users', ...guard, adminCtrl.getAllUsers);
router.post('/users', ...guard, adminCtrl.createUser);
router.patch('/users/:id', ...guard, adminCtrl.updateUser);
router.post('/users/bulk-import', ...guard, upload.single('file'), adminCtrl.bulkImport);
router.post('/users/import-participants', ...guard, upload.single('file'), adminCtrl.bulkImportParticipants);
router.post('/users/bulk-delete', ...guard, adminCtrl.bulkDeleteByRole);

// ── Subjects ──────────────────────────────────────────────────────────────
router.get('/subjects', ...guard, adminCtrl.getSubjects);
router.post('/subjects', ...guard, adminCtrl.createSubject);
router.patch('/subjects/:id', ...guard, adminCtrl.updateSubject);
router.delete('/subjects/:id', ...guard, adminCtrl.deleteSubject);

// ── Classes ───────────────────────────────────────────────────────────────
router.post('/classes/assign-instructor', ...guard, adminCtrl.assignInstructor);
router.post('/classes/enroll-student', ...guard, adminCtrl.enrollStudent);
router.delete('/classes/remove-instructor', ...guard, adminCtrl.removeInstructor);
router.delete('/classes/remove-student', ...guard, adminCtrl.removeStudent);
router.get('/classes/:subject_id/members', ...guard, adminCtrl.getClassMembers);

// ── Reports ───────────────────────────────────────────────────────────────
router.get('/reports/instructors', ...guard, adminCtrl.reportInstructors);
router.get('/reports/teachers', ...guard, adminCtrl.reportInstructors); // alias
router.get('/reports/students', ...guard, adminCtrl.reportStudents);
router.get('/reports/subject/:id', ...guard, adminCtrl.reportSubject);
router.get('/reports/rank-list/:semester_id', ...guard, acad.getRankList);
router.get('/reports/report-card/:student_id/:semester_id', ...guard, acad.getReportCard);
router.get('/reports/department-attendance',  ...guard, adminCtrl.reportDepartmentAttendance);
router.get('/reports/teacher-activity-today', ...guard, adminCtrl.reportTeacherActivityToday);

// ── Settings ──────────────────────────────────────────────────────────────
router.get('/settings', ...guard, adminCtrl.getSettings);
router.patch('/settings', ...guard, adminCtrl.updateSettings);

// ── Messages (legacy) ─────────────────────────────────────────────────────
router.post('/messages', ...guard, adminCtrl.sendMessage);

// ── Academic ─────────────────────────────────────────────────────────────
router.get('/departments', ...guard, acad.getDepartments);
router.post('/departments', ...guard, acad.createDepartment);
router.patch('/departments/:id', ...guard, acad.updateDepartment);
router.delete('/departments/:id', ...guard, acad.deleteDepartment);

router.get('/courses', ...guard, acad.getCourses);
router.post('/courses', ...guard, acad.createCourse);
router.patch('/courses/:id', ...guard, acad.updateCourse);
router.delete('/courses/:id', ...guard, acad.deleteCourse);

router.get('/academic-years', ...guard, acad.getAcademicYears);
router.post('/academic-years', ...guard, acad.createAcademicYear);
router.patch('/academic-years/:id', ...guard, acad.updateAcademicYear);
router.delete('/academic-years/:id', ...guard, acad.deleteAcademicYear);
router.post('/academic-years/:id/set-current', ...guard, acad.setCurrentAcademicYear);

router.get('/semesters', ...guard, acad.getSemesters);
router.post('/semesters', ...guard, acad.createSemester);
router.patch('/semesters/:id', ...guard, acad.updateSemester);
router.delete('/semesters/:id', ...guard, acad.deleteSemester);
router.post('/semesters/:id/set-current', ...guard, acad.setCurrentSemester);

router.get('/timetable', ...guard, acad.getTimetableSlots);
router.post('/timetable', ...guard, acad.createTimetableSlot);
router.patch('/timetable/:id', ...guard, acad.updateTimetableSlot);
router.delete('/timetable/:id', ...guard, acad.deleteTimetableSlot);

// Per-class mentor assignment
router.get('/mentors', ...guard, acad.getMentorsList);
router.get('/subjects/:subject_id/mentor-assignments', ...guard, acad.getSubjectMentorAssignments);
router.post('/class-mentors', ...guard, acad.assignClassMentor);
router.post('/class-mentors/import', ...guard, upload.single('file'), acad.bulkImportClassMentors);

router.get('/results', ...guard, acad.getResults);
router.get('/results/:semester_id', ...guard, (req, res, next) => {
  req.query.semester_id = req.params.semester_id;
  next();
}, acad.getResults);
router.post('/results', ...guard, acad.upsertResult);
router.post('/results/publish', ...guard, acad.publishResults);
router.post('/results/generate/:semester_id', ...guard, acad.generateResultsSemester);
router.post('/results/generate-year/:academic_year_id/:course_id', ...guard, acad.generateResultsYear);

// ── Course Enrollments ────────────────────────────────────────────────────
router.post('/enroll', ...guard, acad.enrollInCourse);
router.get('/enrollments', ...guard, acad.getCourseEnrollments);

// ── Operations ────────────────────────────────────────────────────────────
router.get('/attendance-corrections', ...guard, ops.getAttendanceCorrections);
router.patch('/attendance-corrections/:id', ...guard, ops.reviewAttendanceCorrection);

router.get('/leave-requests', ...guard, ops.getLeaveRequests);
router.patch('/leave-requests/:id', ...guard, ops.reviewLeaveRequest);

router.get('/notifications', ...guard, ops.getNotifications);
router.post('/notifications', ...guard, ops.sendNotification);

router.get('/audit-logs', ...guard, ops.getAuditLogs);

router.get('/backups', ...guard, ops.getBackups);
router.post('/backups', ...guard, ops.createBackup);
router.get('/backups/:id/download', ...guard, ops.downloadBackup);

export default router;
