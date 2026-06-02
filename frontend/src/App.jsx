import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { setTokenGetter } from './utils/api';

// ── Auth pages ────────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';
import AuthCallback from './pages/auth/AuthCallback';
import OnboardingPage from './pages/auth/OnboardingPage';
import PendingPage from './pages/auth/PendingPage';
import SuspendedPage from './pages/auth/SuspendedPage';
import NotAdminPage from './pages/auth/NotAdminPage';

// ── Admin pages ───────────────────────────────────────────────────────────
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPendingUsers from './pages/admin/AdminPendingUsers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSubjects from './pages/admin/AdminSubjects';
import AdminClasses from './pages/admin/AdminClasses';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminCourses from './pages/admin/AdminCourses';
import AdminAcademicYears from './pages/admin/AdminAcademicYears';
import AdminTimetable from './pages/admin/AdminTimetable';
import AdminClassMentors from './pages/admin/AdminClassMentors';
import AdminResults from './pages/admin/AdminResults';
import AdminAttendanceCorrections from './pages/admin/AdminAttendanceCorrections';
import AdminLeaveRequests from './pages/admin/AdminLeaveRequests';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminBackups from './pages/admin/AdminBackups';
import AdminEnrollments from './pages/admin/AdminEnrollments';

// ── Teacher pages ─────────────────────────────────────────────────────────
import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherClasses from './pages/teacher/TeacherClasses';
import TeacherSession from './pages/teacher/TeacherSession';
import TeacherReports from './pages/teacher/TeacherReports';
import TeacherMessages from './pages/teacher/TeacherMessages';
import TeacherMarks from './pages/teacher/TeacherMarks';
import TeacherMarksHistory from './pages/teacher/TeacherMarksHistory';
import TeacherManualAttendance from './pages/teacher/TeacherManualAttendance';
import TeacherTimetable from './pages/teacher/TeacherTimetable';
import TeacherLeaveRequests from './pages/teacher/TeacherLeaveRequests';
import TeacherStudentPerformance from './pages/teacher/TeacherStudentPerformance';
import TeacherDefaulters from './pages/teacher/TeacherDefaulters';
import TeacherAttendanceCorrections from './pages/teacher/TeacherAttendanceCorrections';

// ── Mentor pages ──────────────────────────────────────────────────────────
import MentorLayout from './pages/mentor/MentorLayout';
import MentorDashboard from './pages/mentor/MentorDashboard';
import MentorStudents from './pages/mentor/MentorStudents';
import MentorAttendance from './pages/mentor/MentorAttendance';
import MentorDefaulters from './pages/mentor/MentorDefaulters';
import MentorStudentDetail from './pages/mentor/MentorStudentDetail';
import MentorCounseling from './pages/mentor/MentorCounseling';
import MentorParentContacts from './pages/mentor/MentorParentContacts';
import MentorMeetings from './pages/mentor/MentorMeetings';
import MentorAlerts from './pages/mentor/MentorAlerts';
import MentorMessages from './pages/mentor/MentorMessages';

// ── Student pages ─────────────────────────────────────────────────────────
import StudentLayout from './pages/student/StudentLayout';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentHome from './pages/student/StudentHome';
import StudentMarkAttendance from './pages/student/StudentMarkAttendance';
import StudentInbox from './pages/student/StudentInbox';
import StudentMarks from './pages/student/StudentMarks';
import StudentResults from './pages/student/StudentResults';
import StudentLeave from './pages/student/StudentLeave';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentProfile from './pages/student/StudentProfile';
import StudentMentor from './pages/student/StudentMentor';

// ── Route guard ───────────────────────────────────────────────────────────
function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  if (user.status !== 'active') return <Navigate to="/auth/pending" replace />;
  return children;
}

export default function App() {
  const { token, logout } = useAuth();
  useEffect(() => { setTokenGetter(() => token); }, [token]);
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  return (
    <Routes>
      {/* ── Auth ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/onboarding" element={<OnboardingPage />} />
      <Route path="/auth/pending" element={<PendingPage />} />
      <Route path="/auth/suspended" element={<SuspendedPage />} />
      <Route path="/auth/not-admin" element={<NotAdminPage />} />
      <Route path="/auth/error" element={<SuspendedPage message="Authentication failed. Please try again." />} />

      {/* ── Admin ── */}
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminDashboard />} />
        <Route path="pending" element={<AdminPendingUsers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="courses" element={<AdminCourses />} />
        <Route path="academic-years" element={<AdminAcademicYears />} />
        <Route path="subjects" element={<AdminSubjects />} />
        <Route path="classes" element={<AdminClasses />} />
        <Route path="timetable" element={<AdminTimetable />} />
        <Route path="class-mentors" element={<AdminClassMentors />} />
        <Route path="enrollments" element={<AdminEnrollments />} />
        <Route path="corrections" element={<AdminAttendanceCorrections />} />
        <Route path="leave" element={<AdminLeaveRequests />} />
        <Route path="results" element={<AdminResults />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAuditLogs />} />
        <Route path="backups" element={<AdminBackups />} />
      </Route>

      {/* ── Teacher ── */}
      <Route path="/teacher" element={<RequireAuth roles={['teacher']}><TeacherLayout /></RequireAuth>}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<TeacherDashboard />} />
        <Route path="classes" element={<TeacherClasses />} />
        <Route path="session/:id" element={<TeacherSession />} />
        <Route path="reports" element={<TeacherReports />} />
        <Route path="messages" element={<TeacherMessages />} />
        <Route path="marks" element={<TeacherMarks />} />
        <Route path="marks-history" element={<TeacherMarksHistory />} />
        <Route path="manual-attendance" element={<TeacherManualAttendance />} />
        <Route path="performance" element={<TeacherStudentPerformance />} />
        <Route path="defaulters" element={<TeacherDefaulters />} />
        <Route path="timetable" element={<TeacherTimetable />} />
        <Route path="corrections" element={<TeacherAttendanceCorrections />} />
        <Route path="leave-requests" element={<TeacherLeaveRequests />} />
      </Route>

      {/* ── Mentor ── */}
      <Route path="/mentor" element={<RequireAuth roles={['mentor']}><MentorLayout /></RequireAuth>}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<MentorDashboard />} />
        <Route path="students" element={<MentorStudents />} />
        <Route path="students/:studentId" element={<MentorStudentDetail />} />
        <Route path="alerts" element={<MentorAlerts />} />
        <Route path="messages" element={<MentorMessages />} />
        <Route path="counseling" element={<MentorCounseling />} />
        <Route path="contacts" element={<MentorParentContacts />} />
        <Route path="meetings" element={<MentorMeetings />} />
        <Route path="attendance" element={<MentorAttendance />} />
        <Route path="defaulters" element={<MentorDefaulters />} />
      </Route>

      {/* ── Student ── */}
      <Route path="/student" element={<RequireAuth roles={['student']}><StudentLayout /></RequireAuth>}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<StudentDashboard />} />
        <Route path="attendance" element={<StudentMarkAttendance />} />
        <Route path="marks" element={<StudentMarks />} />
        <Route path="results" element={<StudentResults />} />
        <Route path="timetable" element={<StudentTimetable />} />
        <Route path="leave" element={<StudentLeave />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="mentor" element={<StudentMentor />} />
        <Route path="inbox" element={<StudentInbox />} />
      </Route>

      {/* ── Root redirect ── */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
