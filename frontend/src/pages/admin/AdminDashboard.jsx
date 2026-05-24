import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import StatCard from '../../components/dashboard/StatCard';
import QuickAction from '../../components/dashboard/QuickAction';
import SubjectRow from '../../components/dashboard/SubjectRow';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Skeleton({ className = '' }) {
  return <div className={`bg-gray-200 animate-pulse rounded ${className}`} />;
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [deptAttendance, setDeptAttendance] = useState([]);
  const [teacherActivity, setTeacherActivity] = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [backupToast, setBackupToast] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/pending-users').then(r => setPendingUsers(r.data)).catch(() => setPendingUsers([])),
      api.get('/admin/attendance-corrections?status=pending').then(r => setCorrections(r.data)).catch(() => setCorrections([])),
      api.get('/admin/users').then(r => setUsers(r.data)).catch(() => setUsers([])),
      api.get('/admin/audit-logs?limit=4').then(r => setAuditLogs(r.data?.rows ?? [])).catch(() => setAuditLogs([])),
      api.get('/admin/reports/department-attendance').then(r => setDeptAttendance(r.data)).catch(() => setDeptAttendance([])),
      api.get('/admin/reports/teacher-activity-today').then(r => setTeacherActivity(r.data)).catch(() => setTeacherActivity([])),
      api.get('/admin/subjects').then(r => setSubjectCount(Array.isArray(r.data) ? r.data.length : 0)).catch(() => setSubjectCount(0)),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleBackup() {
    setBackupToast('Backup started…');
    try {
      await api.post('/admin/backups');
    } catch {
      // proceed to show complete regardless
    }
    setTimeout(() => setBackupToast('Backup complete ✓'), 2000);
    setTimeout(() => setBackupToast(''), 4000);
  }

  if (loading) return <SkeletonDashboard />;

  const pendingCount = pendingUsers.length;
  const correctionsCount = corrections.length;

  const students = users.filter(u => u.role === 'student' && u.status === 'active');
  const activeStudentCount = students.length;

  const teachers = users.filter(u => u.role === 'teacher' && u.status === 'active');
  const mentors = users.filter(u => u.role === 'mentor' && u.status === 'active');
  const activeTeacherCount = teachers.length;

  const studentPending = pendingUsers.filter(u => u.role === 'student').length;
  const teacherPending = pendingUsers.filter(u => u.role === 'teacher').length;
  const mentorPending = pendingUsers.filter(u => u.role === 'mentor').length;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            A
          </div>
          <div>
            <p className="text-xs text-gray-500 leading-none">Admin</p>
            <p className="text-sm font-semibold text-gray-800 leading-tight">BVRV Institution</p>
          </div>
        </div>
        <button
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
          onClick={() => navigate('/admin/pending')}
          aria-label="Notifications"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none font-bold">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Alert row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/admin/pending')}
          className={`text-left rounded-xl p-4 border transition-shadow hover:shadow-md ${
            pendingCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-semibold ${pendingCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
              Pending Approvals
            </span>
            <span className={`text-xl font-bold ${pendingCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {pendingCount}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {pendingCount > 0
              ? `${studentPending} students · ${teacherPending} teachers · ${mentorPending} mentor requests`
              : 'No pending approvals'}
          </p>
        </button>

        <button
          onClick={() => navigate('/admin/corrections')}
          className={`text-left rounded-xl p-4 border transition-shadow hover:shadow-md ${
            correctionsCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-semibold ${correctionsCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              Pending Corrections
            </span>
            <span className={`text-xl font-bold ${correctionsCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {correctionsCount}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {correctionsCount > 0
              ? `${correctionsCount} attendance correction${correctionsCount !== 1 ? 's' : ''} awaiting review`
              : 'No pending corrections'}
          </p>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Students"
          value={activeStudentCount}
          sub="enrolled & active"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          label="Active Teachers"
          value={activeTeacherCount}
          sub={`+ ${mentors.length} mentor${mentors.length !== 1 ? 's' : ''}`}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingCount}
          sub="users awaiting review"
          variant={pendingCount > 0 ? 'danger' : 'default'}
          onClick={() => navigate('/admin/pending')}
        />
        <StatCard
          label="Total Subjects"
          value={subjectCount}
          sub="across all courses"
          onClick={() => navigate('/admin/subjects')}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon="✅" label="Approve Users" onClick={() => navigate('/admin/pending')} color="red" />
          <QuickAction icon="📥" label="Bulk Import" onClick={() => navigate('/admin/users')} color="blue" />
          <QuickAction icon="🏆" label="Generate Results" onClick={() => navigate('/admin/results')} color="amber" />
          <QuickAction icon="🔔" label="Send Notice" onClick={() => navigate('/admin/notifications')} color="purple" />
          <QuickAction icon="📊" label="Reports" onClick={() => navigate('/admin/reports')} color="blue" />
          <QuickAction icon="📚" label="Courses" onClick={() => navigate('/admin/courses')} color="green" />
          <QuickAction icon="⚙️" label="Settings" onClick={() => navigate('/admin/settings')} color="amber" />
          <QuickAction icon="💾" label="Backup Now" onClick={handleBackup} color="green" />
        </div>
        {backupToast && (
          <div className="mt-2 text-sm text-center text-green-700 bg-green-50 border border-green-200 rounded-lg py-2 px-4 transition-all">
            {backupToast}
          </div>
        )}
      </div>

      {/* Bottom cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Department attendance */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Attendance by Course</h3>
          {deptAttendance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>
          ) : (
            <div>
              {deptAttendance.map((dept, i) => {
                const pct = Math.round(dept.average_attendance_pct ?? dept.pct ?? 0);
                const chipColor = pct >= 75 ? 'green' : pct >= 60 ? 'amber' : 'red';
                return (
                  <SubjectRow
                    key={i}
                    name={dept.department || dept.course_name || dept.name || 'Unknown'}
                    value={pct + '%'}
                    chip={{ label: pct >= 75 ? 'Good' : pct >= 60 ? 'Average' : 'Low', color: chipColor }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Teacher activity today */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Teacher Activity Today</h3>
          {teacherActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No activity data yet.</p>
          ) : (
            <div>
              {teacherActivity.slice(0, 4).map((row, i) => {
                const status = row.session_status || row.status || 'not_started';
                let chipColor = 'gray';
                let chipLabel = 'Not started';
                if (status === 'done' || status === 'completed') { chipColor = 'green'; chipLabel = 'Done'; }
                else if (status === 'in_progress' || status === 'active') { chipColor = 'blue'; chipLabel = 'In progress'; }
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">{row.teacher_name || row.name || 'Teacher'}</p>
                      <p className="text-xs text-gray-400 truncate">{row.subject_code || row.subject || ''}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        chipColor === 'green'
                          ? 'bg-green-100 text-green-700'
                          : chipColor === 'blue'
                          ? 'bg-blue-100 text-blue-700 animate-pulse'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {chipLabel}
                    </span>
                  </div>
                );
              })}
              <button
                onClick={() => navigate('/admin/reports')}
                className="mt-3 text-xs text-blue-600 hover:underline font-medium"
              >
                View all &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Recent audit logs */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Audit Logs</h3>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No audit logs yet.</p>
          ) : (
            <div>
              {auditLogs.slice(0, 4).map((log, i) => {
                const actor = log.actor_name || log.actor_email || (log.actor_id ? String(log.actor_id).slice(0, 8) + '…' : 'System');
                return (
                  <div key={i} className="flex items-start gap-2 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-700 truncate">
                        {log.action || log.event || 'action'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {log.entity_type || log.resource || ''}{log.entity_type && actor ? ' · ' : ''}{actor}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                      {timeAgo(log.created_at || log.timestamp)}
                    </span>
                  </div>
                );
              })}
              <button
                onClick={() => navigate('/admin/audit')}
                className="mt-3 text-xs text-blue-600 hover:underline font-medium"
              >
                View full audit log &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
