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

// ── SessionCountdown (inline) ───────────────────────────────────────────────
function SessionCountdown({ expiresAt }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setLabel('Expired'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!label) return null;
  return (
    <span className="text-xs font-mono text-gray-500">{label}</span>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4 mb-6">
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
      <div className="bg-white rounded-xl h-40 shadow-sm" />
      <div className="bg-white rounded-xl h-40 shadow-sm" />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [correctionsCount, setCorrectionsCount] = useState(0);
  const [startingFor, setStartingFor] = useState({}); // { subject_id: true }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [
        subjectsRes,
        activeRes,
        recentRes,
        timetableRes,
        leaveRes,
        correctionsRes,
      ] = await Promise.allSettled([
        api.get('/teacher/subjects'),
        api.get('/teacher/sessions/active'),
        api.get('/teacher/sessions/recent?limit=4'),
        api.get('/teacher/timetable'),
        api.get('/teacher/leave-requests?status=pending&limit=3'),
        api.get('/teacher/attendance-corrections?status=pending'),
      ]);

      if (cancelled) return;

      setSubjects(subjectsRes.status === 'fulfilled' ? (subjectsRes.value.data ?? []) : []);
      setActiveSessions(activeRes.status === 'fulfilled' ? (activeRes.value.data ?? []) : []);
      setRecentSessions(recentRes.status === 'fulfilled' ? (recentRes.value.data ?? []) : []);
      setTimetable(timetableRes.status === 'fulfilled' ? (timetableRes.value.data ?? []) : []);
      setLeaveRequests(leaveRes.status === 'fulfilled' ? (leaveRes.value.data ?? []) : []);

      if (correctionsRes.status === 'fulfilled') {
        const data = correctionsRes.value.data;
        setCorrectionsCount(Array.isArray(data) ? data.length : (data?.count ?? 0));
      }

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Today's day_of_week: Mon=0 … Sun=6
  const todayDow = (new Date().getDay() + 6) % 7;
  const todaySlots = timetable.filter(slot => slot.day_of_week === todayDow);

  const totalStudents = subjects.reduce((sum, s) => sum + Number(s.student_count ?? 0), 0);

  function isSlotNow(slot) {
    const now = new Date();
    const [sh, sm] = (slot.start_time || '').split(':').map(Number);
    const [eh, em] = (slot.end_time || '').split(':').map(Number);
    const startMins = sh * 60 + sm - 30;
    const endMins = eh * 60 + em + 30;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= startMins && nowMins <= endMins;
  }

  function activeSessionForSubject(subjectId) {
    return activeSessions.find(s => s.subject_id === subjectId);
  }

  async function startSession(subjectId) {
    setStartingFor(prev => ({ ...prev, [subjectId]: true }));
    try {
      const res = await api.post('/teacher/sessions/open', { subject_id: subjectId });
      const session = res.data;
      navigate(`/teacher/session/${session.session_id ?? session.id}`, {
        state: { pin: session.pin_display ?? session.pin, expiresAt: session.expires_at },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start session.');
    } finally {
      setStartingFor(prev => ({ ...prev, [subjectId]: false }));
    }
  }

  if (loading) return <Skeleton />;

  const displayName = user?.name || user?.email || 'Teacher';
  const subText = user?.employee_id || user?.email || '';

  return (
    <div className="space-y-6">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{displayName}</h1>
          {subText && <p className="text-xs text-gray-500">{subText}</p>}
        </div>
      </div>

      {/* ── Active sessions banner ── */}
      {activeSessions.length > 0 && (
        <div className="space-y-2">
          <AlertBanner
            variant="warning"
            message={`🟢 ${activeSessions.length} session(s) currently live. Click to manage.`}
            onClick={() => navigate(`/teacher/session/${activeSessions[0].session_id}`)}
          />
          <div className="bg-green-50 rounded-xl border border-green-200 divide-y divide-green-100 overflow-hidden">
            {activeSessions.map(session => (
              <div
                key={session.session_id}
                onClick={() => navigate(`/teacher/session/${session.session_id}`)}
                className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-green-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-900 text-sm truncate">{session.subject_name}</p>
                  <p className="text-xs text-green-700">
                    {session.present_count ?? 0} present
                    {session.pin_display && (
                      <span className="ml-2 font-mono font-bold">PIN: {session.pin_display}</span>
                    )}
                  </p>
                </div>
                <SessionCountdown expiresAt={session.expires_at} />
                <span className="text-green-600 text-sm font-medium flex-shrink-0">Open →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Students"
          value={totalStudents}
          sub={`across ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
          onClick={() => navigate('/teacher/classes')}
        />
        <StatCard
          label="Pending Corrections"
          value={correctionsCount}
          variant={correctionsCount > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/teacher/corrections')}
        />
        <StatCard
          label="Pending Leave"
          value={leaveRequests.length}
          variant={leaveRequests.length > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/teacher/leave-requests')}
        />
        <StatCard
          label="Active Sessions"
          value={activeSessions.length}
          variant={activeSessions.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* ── Today's classes ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Today's Classes</h2>
        {todaySlots.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">
            No classes scheduled for today.
          </div>
        ) : (
          <div className="space-y-3">
            {todaySlots.map((slot, i) => {
              const active = activeSessionForSubject(slot.subject_id);
              const withinWindow = isSlotNow(slot);
              return (
                <div key={i} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {slot.subject_name}
                      {slot.subject_code && (
                        <span className="ml-2 text-xs font-mono text-gray-400">{slot.subject_code}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {slot.start_time}–{slot.end_time}
                      {slot.room && <span className="ml-2">· {slot.room}</span>}
                      {slot.student_count != null && (
                        <span className="ml-2">· {slot.student_count} students</span>
                      )}
                    </p>
                  </div>
                  {active ? (
                    <button
                      onClick={() => navigate(`/teacher/session/${active.session_id}`)}
                      className="flex-shrink-0 text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Session live →
                    </button>
                  ) : (
                    <button
                      onClick={() => startSession(slot.subject_id)}
                      disabled={!!startingFor[slot.subject_id]}
                      className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                        withinWindow
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {startingFor[slot.subject_id] ? 'Starting…' : 'Start Session'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '📊', label: 'Upload Marks', color: 'blue', path: '/teacher/marks' },
            { icon: '🚨', label: 'Defaulters', color: 'red', path: '/teacher/defaulters' },
            { icon: '💬', label: 'Message Class', color: 'purple', path: '/teacher/messages' },
            { icon: '📅', label: 'Timetable', color: 'green', path: '/teacher/timetable' },
          ].map(({ icon, label, color, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer`}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Bottom grid: recent sessions + pending leave ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent sessions */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Sessions</h2>
          </div>
          {recentSessions.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No recent sessions.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentSessions.map(session => (
                <li
                  key={session.id}
                  onClick={() => navigate(`/teacher/session/${session.id}`)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{session.subject_name}</p>
                    <p className="text-xs text-gray-400">{timeAgo(session.opened_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {session.present_count ?? 0}
                      {session.total_students != null && (
                        <span className="font-normal text-gray-400">/{session.total_students}</span>
                      )}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        session.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {session.status ?? 'closed'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending leave requests */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Pending Leave Requests</h2>
            <button
              onClick={() => navigate('/teacher/leave-requests')}
              className="text-xs text-blue-600 hover:underline"
            >
              Review all →
            </button>
          </div>
          {leaveRequests.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No pending leave requests.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {leaveRequests.map(req => (
                <li key={req.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {(req.student_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{req.student_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {req.subject_name || 'All subjects'}
                      {req.from_date && (
                        <span className="ml-1">
                          · {new Date(req.from_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {req.to_date && req.to_date !== req.from_date && (
                            <span>–{new Date(req.to_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    pending
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
