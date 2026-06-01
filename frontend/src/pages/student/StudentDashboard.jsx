import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/dashboard/StatCard';
import AlertBanner from '../../components/dashboard/AlertBanner';
import QuickAction from '../../components/dashboard/QuickAction';
import SubjectRow from '../../components/dashboard/SubjectRow';
import TodayPill from '../../components/dashboard/TodayPill';

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function avg(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ attendance_threshold: 75 });
  const [results, setResults] = useState([]);
  const [marks, setMarks] = useState([]);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);

  useEffect(() => {
    async function loadAll() {
      const settle = (p) => p.catch(() => null);

      const [
        attendanceRes,
        settingsRes,
        resultsRes,
        marksRes,
        leaveRes,
        messagesRes,
        todayRes,
      ] = await Promise.all([
        settle(api.get('/student/attendance')),
        settle(api.get('/student/settings')),
        settle(api.get('/student/results')),
        settle(api.get('/student/marks')),
        settle(api.get('/student/leave-requests?status=pending')),
        settle(api.get('/student/messages?limit=3')),
        settle(api.get('/student/attendance/today')),
      ]);

      if (attendanceRes) setAttendance(attendanceRes.data ?? []);
      if (settingsRes) setSettings(settingsRes.data ?? { attendance_threshold: 75 });
      if (resultsRes) setResults(resultsRes.data ?? []);
      if (marksRes) setMarks(marksRes.data ?? []);
      if (leaveRes) {
        const d = leaveRes.data;
        setPendingLeaveCount(Array.isArray(d) ? d.length : d?.count ?? 0);
      }
      if (messagesRes) setMessages(messagesRes.data ?? []);
      if (todayRes) setTodaySessions(todayRes.data ?? []);

      setLoading(false);
    }
    loadAll();
  }, []);

  // ── derived values ──────────────────────────────────────────────────────────

  const threshold = Number(settings?.attendance_threshold ?? 75);

  const subjectsWithPct = attendance.map((s) => ({
    ...s,
    pct: Number(s.attendance_pct ?? s.percentage ?? 0),
  }));

  const overallPct = avg(subjectsWithPct.map((s) => s.pct));

  const belowThreshold = subjectsWithPct
    .filter((s) => s.pct < threshold)
    .sort((a, b) => a.pct - b.pct);

  const latestResult = results.slice().sort((a, b) => {
    if (a.semester_id && b.semester_id) return b.semester_id - a.semester_id;
    return 0;
  })[0];

  const unreadCount = messages.filter((m) => !m.read_at).length;

  const sortedByPct = [...subjectsWithPct].sort((a, b) => a.pct - b.pct).slice(0, 4);

  const recentMarks = marks.slice(0, 3);

  // ── alert banner message ────────────────────────────────────────────────────

  let alertMsg = null;
  if (belowThreshold.length > 0) {
    const worst = belowThreshold[0];
    const name = worst.subject_name ?? worst.name ?? 'Subject';
    alertMsg = `⚠ Attendance warning — ${name} is at ${worst.pct}% — below the ${threshold}% threshold`;
    if (belowThreshold.length > 1) alertMsg += ` (+${belowThreshold.length - 1} more)`;
  }

  // ── chip helper ─────────────────────────────────────────────────────────────

  function pctChip(pct) {
    if (pct >= threshold) return { label: `${pct}%`, color: 'green' };
    if (pct >= threshold - 5) return { label: `${pct}%`, color: 'amber' };
    return { label: `${pct}%`, color: 'red' };
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="avatar"
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials(user?.name ?? user?.full_name ?? '')}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 leading-tight">
              {user?.name ?? user?.full_name ?? 'Student'}
            </p>
            {user?.roll_number && (
              <p className="text-xs text-gray-500">{user.roll_number}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/student/inbox')}
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Inbox"
        >
          <svg
            className="w-6 h-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Alert banner ── */}
      {alertMsg && (
        <AlertBanner
          message={alertMsg}
          variant="danger"
          onClick={() => navigate('/student/attendance')}
        />
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Overall Attendance"
          value={overallPct !== null ? `${overallPct}%` : '—'}
          sub={`${subjectsWithPct.length} subjects`}
          onClick={() => navigate('/student/attendance')}
          variant={
            overallPct !== null && overallPct < threshold
              ? 'danger'
              : overallPct !== null && overallPct < threshold + 5
              ? 'warning'
              : 'default'
          }
        />
        <StatCard
          label="Semester GPA"
          value={latestResult?.gpa ?? '—'}
          sub={latestResult?.semester_label ?? ''}
          onClick={() => navigate('/student/results')}
        />
        <StatCard
          label="CGPA"
          value={latestResult?.cgpa ?? '—'}
          sub="Cumulative"
          onClick={() => navigate('/student/results')}
        />
        <StatCard
          label="Pending Leave"
          value={pendingLeaveCount}
          sub="requests"
          onClick={() => navigate('/student/leave')}
          variant={pendingLeaveCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-4 gap-3">
        <QuickAction
          icon="📝"
          label="Mark Attendance"
          color="blue"
          onClick={() => navigate('/student/attendance')}
        />
        <QuickAction
          icon="📅"
          label="Timetable"
          color="purple"
          onClick={() => navigate('/student/timetable')}
        />
        <QuickAction
          icon="🏖"
          label="Apply Leave"
          color="amber"
          onClick={() => navigate('/student/leave')}
        />
        <QuickAction
          icon="📄"
          label="Download Memo"
          color="green"
          onClick={() => navigate('/student/results')}
        />
      </div>

      {/* ── Today's sessions ── */}
      {todaySessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Today's Sessions</h2>
          <div className="flex flex-wrap gap-2">
            {todaySessions.map((s) => {
              let status = 'none';
              if (s.already_marked) status = 'present';
              else if (s.session_open) status = 'pending';
              return (
                <TodayPill
                  key={s.subject_id}
                  subjectName={s.subject_name}
                  status={status}
                  onClick={
                    status === 'pending'
                      ? () => navigate('/student/mark-attendance')
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Subject attendance ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Subject Attendance</h2>
          <button
            onClick={() => navigate('/student/attendance')}
            className="text-xs text-primary-600 hover:underline"
          >
            View all →
          </button>
        </div>
        {sortedByPct.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No data yet.</p>
        ) : (
          sortedByPct.map((s) => (
            <SubjectRow
              key={s.subject_id ?? s.id}
              code={s.subject_code ?? s.code ?? ''}
              name={s.subject_name ?? s.name ?? ''}
              value={`${s.pct}%`}
              chip={pctChip(s.pct)}
              onClick={() => navigate('/student/attendance')}
            />
          ))
        )}
      </div>

      {/* ── Recent marks ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Marks</h2>
          <button
            onClick={() => navigate('/student/marks')}
            className="text-xs text-primary-600 hover:underline"
          >
            View all →
          </button>
        </div>
        {recentMarks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No marks published yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentMarks.map((m, i) => {
              const subject = m.subject_name ?? m.subject ?? '—';
              const scored = m.marks_obtained ?? m.scored ?? m.marks ?? '—';
              const max = m.max_marks ?? m.total ?? '—';
              const grade = m.grade ?? '';
              return (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{subject}</p>
                    <p className="text-xs text-gray-400">{m.assessment_name ?? m.type ?? 'Assessment'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      {scored}/{max}
                    </span>
                    {grade && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {grade}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Inbox ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Inbox</h2>
          <button
            onClick={() => navigate('/student/inbox')}
            className="text-xs text-primary-600 hover:underline"
          >
            View all →
          </button>
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No messages yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((msg, i) => {
              const unread = !msg.read_at;
              const sender = msg.sender_name ?? msg.from ?? 'System';
              const preview =
                (msg.body ?? msg.message ?? msg.preview ?? '').slice(0, 45) +
                ((msg.body ?? msg.message ?? msg.preview ?? '').length > 45 ? '…' : '');
              return (
                <div
                  key={msg.id ?? i}
                  className="flex items-start gap-3 py-3 cursor-pointer hover:bg-gray-50 rounded-lg px-1 transition-colors"
                  onClick={() => navigate('/student/inbox')}
                >
                  {unread && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  )}
                  {!unread && <span className="mt-1.5 w-2 h-2 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${unread ? 'text-gray-900' : 'text-gray-600'}`}>
                        {sender}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {timeAgo(msg.created_at ?? msg.sent_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{preview}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
