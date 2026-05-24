import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';

export default function TeacherSession() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const pin = state?.pin || '------';
  const expiresAt = state?.expiresAt ? new Date(state.expiresAt) : null;

  const [students, setStudents] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [closed, setClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [overriding, setOverriding] = useState({});

  const pollRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const r = await api.get(`/teacher/sessions/${id}/live`);
      setStudents(r.data);
    } catch {
      // silently ignore transient errors during polling
    }
  }, [id]);

  // Start polling on mount, stop when closed
  useEffect(() => {
    if (closed) return;
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [poll, closed]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        setExpired(true);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function closeSession() {
    setClosing(true);
    try {
      await api.post(`/teacher/sessions/${id}/close`);
      clearInterval(pollRef.current);
      setClosed(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to close session.');
    } finally {
      setClosing(false);
    }
  }

  async function overrideStatus(logId, status) {
    setOverriding(prev => ({ ...prev, [logId]: true }));
    try {
      await api.patch(`/teacher/attendance/${logId}`, { status });
      await poll();
    } catch {
      // status badge will revert on next poll
    } finally {
      setOverriding(prev => ({ ...prev, [logId]: false }));
    }
  }

  const presentCount = students.filter(s => s.status === 'present' || s.status === 'late').length;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        {closed ? (
          <Link
            to="/teacher/classes"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Back to classes
          </Link>
        ) : (
          <div />
        )}
        {!closed && (
          <button
            onClick={closeSession}
            disabled={closing}
            className="btn-danger text-sm disabled:opacity-60"
          >
            {closing ? 'Closing…' : 'Close Session'}
          </button>
        )}
      </div>

      {closed && (
        <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-lg px-4 py-3 text-center font-medium mb-6">
          Session closed — attendance has been recorded.
        </div>
      )}

      {/* PIN + count cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* PIN card */}
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2 font-medium">Attendance PIN</p>
          <div className="font-mono text-5xl font-bold tracking-widest text-blue-700 select-all">
            {pin}
          </div>
          {expiresAt && (
            <p
              className={`text-sm mt-3 font-medium ${
                expired ? 'text-red-500' : 'text-gray-500'
              }`}
            >
              {expired ? 'Session expired' : `Expires in ${timeLeft}`}
            </p>
          )}
          {!expiresAt && (
            <p className="text-xs text-gray-400 mt-3">Share this PIN with your students</p>
          )}
        </div>

        {/* Present count card */}
        <div className="card">
          <p className="text-sm text-gray-500 mb-2 font-medium">Present Now</p>
          <p className="text-4xl font-bold text-green-600">{presentCount}</p>
          <p className="text-xs text-gray-400 mt-1">
            {students.length} total marked &nbsp;·&nbsp; {students.filter(s => s.status === 'late').length} late &nbsp;·&nbsp; {students.filter(s => s.status === 'flagged').length} flagged
          </p>
        </div>
      </div>

      {/* Live list */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Live Attendance</h2>
          {!closed && (
            <span className="text-xs text-gray-400 animate-pulse">● Updating every 5 s</span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Waiting for students to mark attendance…
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {students.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={s} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">
                    {s.submitted_at
                      ? new Date(s.submitted_at).toLocaleTimeString()
                      : '—'}
                  </p>
                </div>
                <select
                  value={s.status}
                  onChange={e => overrideStatus(s.id, e.target.value)}
                  disabled={!!overriding[s.id] || closed}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="flagged">Flagged</option>
                </select>
                {s.status === 'flagged' && (
                  <span className="text-xs bg-red-100 text-red-600 rounded px-1.5 py-0.5">
                    flagged
                  </span>
                )}
                {s.status === 'late' && (
                  <span className="text-xs bg-amber-100 text-amber-600 rounded px-1.5 py-0.5">
                    late
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} className="w-9 h-9 rounded-full flex-shrink-0" alt="" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}
