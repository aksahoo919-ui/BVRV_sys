import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/dashboard/StatCard';
import AlertBanner from '../../components/dashboard/AlertBanner';
import QuickAction from '../../components/dashboard/QuickAction';
import SubjectRow from '../../components/dashboard/SubjectRow';
import TodayPill from '../../components/dashboard/TodayPill';
import { fmtDayIST } from '../../utils/datetime';

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
  const [todaySessions, setTodaySessions] = useState([]);
  const [bvLeaders, setBvLeaders] = useState([]); // BV Leader class attendance

  useEffect(() => {
    async function loadAll() {
      const settle = (p) => p.catch(() => null);

      const [
        attendanceRes,
        settingsRes,
        resultsRes,
        marksRes,
        todayRes,
        bvRes,
      ] = await Promise.all([
        settle(api.get('/student/attendance')),
        settle(api.get('/student/settings')),
        settle(api.get('/student/results')),
        settle(api.get('/student/marks')),
        settle(api.get('/student/attendance/today')),
        settle(api.get('/student/bv-attendance')),
      ]);

      if (attendanceRes) setAttendance(attendanceRes.data ?? []);
      if (settingsRes) setSettings(settingsRes.data ?? { attendance_threshold: 75 });
      if (resultsRes) setResults(resultsRes.data ?? []);
      if (marksRes) setMarks(marksRes.data ?? []);
      if (todayRes) setTodaySessions(todayRes.data ?? []);
      if (bvRes) setBvLeaders(bvRes.data?.leaders ?? []);

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
          label="Subjects"
          value={subjectsWithPct.length}
          sub="enrolled"
          onClick={() => navigate('/student/attendance')}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-3 gap-3">
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
          icon="📄"
          label="Results"
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

      {/* ── BV Leader class attendance (separate from subject classes) ── */}
      {bvLeaders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">BV Leader Class Attendance</h2>
          <p className="text-xs text-gray-400 mb-3">Your weekly class with your BV Leader.</p>
          <div className="space-y-4">
            {bvLeaders.map((l) => {
              const pct = Number(l.percentage ?? 0);
              const chip = pctChip(pct);
              const chipCls = chip.color === 'green'
                ? 'bg-green-50 text-green-700'
                : chip.color === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
              return (
                <div key={l.mentor_id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{l.mentor_name}</p>
                      <p className="text-xs text-gray-400">{l.attended} of {l.total_sessions} classes attended</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.total_sessions ? chipCls : 'bg-gray-100 text-gray-500'}`}>
                      {l.total_sessions ? `${pct}%` : '—'}
                    </span>
                  </div>
                  {l.records?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {l.records.slice(0, 8).map((r) => (
                        <span
                          key={r.session_date}
                          className={`text-xs px-2 py-0.5 rounded-md ${
                            r.status === 'present' ? 'bg-green-50 text-green-700'
                              : r.status === 'service' ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {fmtDayIST(r.session_date)} · {r.status === 'present' ? 'Present' : r.status === 'service' ? 'Service' : 'Absent'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

    </div>
  );
}
