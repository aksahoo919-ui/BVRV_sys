import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function InstructorSession() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [pin] = useState(state?.pin || '------');
  const [expiresAt] = useState(state?.expiresAt ? new Date(state.expiresAt) : null);
  const [students, setStudents] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [closed, setClosed] = useState(false);
  const pollRef = useRef();

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); clearInterval(timer); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function poll() {
    try {
      const r = await api.get(`/instructor/sessions/${id}/live`);
      setStudents(r.data);
    } catch {}
  }

  async function closeSession() {
    await api.post(`/instructor/sessions/${id}/close`);
    clearInterval(pollRef.current);
    setClosed(true);
  }

  async function overrideStatus(logId, status) {
    await api.patch(`/instructor/attendance/${logId}`, { status });
    poll();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/instructor/classes')} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          ← Back to classes
        </button>
        {!closed && (
          <button onClick={closeSession} className="btn-danger text-sm">Close Session</button>
        )}
      </div>

      {closed && (
        <div className="bg-gray-100 text-gray-600 rounded-lg p-4 text-center mb-6 font-medium">
          Session closed
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2">Attendance PIN</p>
          <div className="font-mono text-5xl font-bold tracking-[0.3em] text-primary-700 select-all">
            {pin}
          </div>
          {expiresAt && (
            <p className={`text-sm mt-3 font-medium ${timeLeft === 'Expired' ? 'text-red-500' : 'text-gray-500'}`}>
              {timeLeft === 'Expired' ? 'Session expired' : `Expires in ${timeLeft}`}
            </p>
          )}
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-2">Present Now</p>
          <p className="text-4xl font-bold text-green-600">{students.filter(s => !s.replayed).length}</p>
          <p className="text-xs text-gray-400 mt-1">students marked</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">Live Attendance</h2>
        </div>
        {students.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">Waiting for students to mark attendance…</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {students.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={s} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{new Date(s.submitted_at).toLocaleTimeString()}</p>
                </div>
                <select
                  value={s.status}
                  onChange={e => overrideStatus(s.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="flagged">Flagged</option>
                </select>
                {s.replayed && <span className="badge bg-orange-100 text-orange-600 text-xs">replay</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-9 h-9 rounded-full" alt="" />;
  return <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">{user.name?.[0]?.toUpperCase()}</div>;
}
