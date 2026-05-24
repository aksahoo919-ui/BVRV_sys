import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import StatCard from '../../components/dashboard/StatCard';
import AlertBanner from '../../components/dashboard/AlertBanner';

// ── timeAgo util ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ── Date helpers ────────────────────────────────────────────────────────────
function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function endOfWeek() {
  const mon = startOfWeek();
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl h-24 shadow-sm" />
        ))}
      </div>
      <div className="bg-white rounded-xl h-48 shadow-sm" />
      <div className="bg-white rounded-xl h-40 shadow-sm" />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [counselingNotes, setCounselingNotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [studentsRes, alertsRes, meetingsRes, counselingRes] = await Promise.allSettled([
        api.get('/mentor/students'),
        api.get('/mentor/alerts'),
        api.get('/mentor/meetings'),
        api.get('/mentor/counseling-notes'),
      ]);
      if (cancelled) return;

      setStudents(studentsRes.status === 'fulfilled' ? (studentsRes.value.data ?? []) : []);
      // alerts endpoint returns { thresholds, alerts } — extract the array
      setAlerts(alertsRes.status === 'fulfilled' ? (alertsRes.value.data?.alerts ?? alertsRes.value.data ?? []) : []);
      setMeetings(meetingsRes.status === 'fulfilled' ? (meetingsRes.value.data ?? []) : []);

      if (counselingRes.status === 'fulfilled') {
        setCounselingNotes(counselingRes.value.data ?? []);
      } else {
        setCounselingNotes([]);
      }

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const monthStart = startOfMonth();

  const meetingsThisWeek = meetings.filter(m => {
    const d = new Date(m.scheduled_at);
    return d >= weekStart && d <= weekEnd;
  });

  const notesThisMonth = counselingNotes.filter(n => {
    return new Date(n.created_at ?? n.date) >= monthStart;
  });

  const lowAtt = alerts.filter(a => a.attendance_percentage != null && a.attendance_percentage < 75).length;
  const lowGpa = alerts.filter(a => a.latest_gpa != null && a.latest_gpa < 5).length;

  const now = new Date();
  const upcomingMeetings = meetings
    .filter(m => m.status === 'pending' && new Date(m.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 2);

  function studentName(studentId) {
    const s = students.find(s => s.id === studentId || s.student_id === studentId);
    return s?.name || s?.student_name || `Student #${studentId}`;
  }

  if (loading) return <SkeletonPage />;

  const displayName = user?.name || user?.email || 'Mentor';

  return (
    <div className="space-y-6">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{displayName}</h1>
          {user?.email && <p className="text-xs text-gray-500">{user.email}</p>}
        </div>
      </div>

      {/* ── Alert banner ── */}
      {alerts.length > 0 && (
        <AlertBanner
          variant="warning"
          message={`⚠ ${alerts.length} student(s) need attention — ${lowAtt} below attendance threshold · ${lowGpa} GPA dropped.`}
          onClick={() => navigate('/mentor/alerts')}
        />
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Assigned Students"
          value={students.length}
          onClick={() => navigate('/mentor/students')}
        />
        <StatCard
          label="Active Alerts"
          value={alerts.length}
          variant={alerts.length > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/mentor/alerts')}
        />
        <StatCard
          label="Meetings This Week"
          value={meetingsThisWeek.length}
          onClick={() => navigate('/mentor/meetings')}
        />
        <StatCard
          label="Notes This Month"
          value={notesThisMonth.length}
          onClick={() => navigate('/mentor/counseling')}
        />
      </div>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '📅', label: 'Schedule Meeting', path: '/mentor/meetings' },
            { icon: '📝', label: 'Add Note', path: '/mentor/counseling' },
            { icon: '📞', label: 'Log Contact', path: '/mentor/contacts' },
            { icon: '💬', label: 'Message Student', path: '/mentor/messages' },
          ].map(({ icon, label, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Students needing attention */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Students Needing Attention</h2>
            {alerts.length > 3 && (
              <button
                onClick={() => navigate('/mentor/students')}
                className="text-xs text-blue-600 hover:underline"
              >
                View all {alerts.length} students →
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">
              All students are on track.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {alerts.slice(0, 3).map(alert => {
                  const reasons = Array.isArray(alert.alert_reasons)
                    ? alert.alert_reasons.join(', ')
                    : (alert.alert_reasons || '');
                  const isRed = alert.attendance_percentage != null && alert.attendance_percentage < 60;
                  return (
                    <li
                      key={alert.student_id}
                      onClick={() => navigate(`/mentor/students/${alert.student_id}`)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(alert.student_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {alert.student_name}
                          {alert.roll_number && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">{alert.roll_number}</span>
                          )}
                        </p>
                        {reasons && (
                          <p className="text-xs text-gray-500 truncate">{reasons}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          isRed
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {alert.attendance_percentage != null ? `${Math.round(alert.attendance_percentage)}%` : 'alert'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {alerts.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <button
                    onClick={() => navigate('/mentor/students')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all {alerts.length} students →
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Upcoming meetings */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Upcoming Meetings</h2>
            <button
              onClick={() => navigate('/mentor/meetings')}
              className="text-xs text-blue-600 hover:underline"
            >
              View all →
            </button>
          </div>
          {upcomingMeetings.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No upcoming meetings.{' '}
              <button
                onClick={() => navigate('/mentor/meetings')}
                className="text-blue-600 hover:underline"
              >
                Schedule one →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingMeetings.map(meeting => {
                const name = studentName(meeting.student_id);
                const agenda = meeting.agenda
                  ? meeting.agenda.length > 45
                    ? meeting.agenda.slice(0, 45) + '…'
                    : meeting.agenda
                  : '—';
                return (
                  <li key={meeting.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                      <p className="text-xs text-gray-500 truncate">{agenda}</p>
                      <p className="text-xs text-gray-400">{fmtDateTime(meeting.scheduled_at)}</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      {meeting.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
