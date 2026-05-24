import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function StudentHome() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/subjects').then(r => setSubjects(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Subjects</h1>
      {subjects.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Not enrolled in any subjects yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map(s => (
            <div key={s.id} className={`card ${s.warning ? 'border-amber-300 bg-amber-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <span className="font-mono text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{s.code}</span>
                {s.warning && <span className="text-amber-500 text-sm" title="Below attendance threshold">⚠ Low attendance</span>}
              </div>
              <h3 className="font-semibold text-gray-900 mb-4">{s.name}</h3>
              <div className="flex items-center gap-4">
                <CircularProgress percentage={Number(s.percentage)} warning={s.warning} />
                <div>
                  <p className="text-xs text-gray-500">{s.attended} of {s.total_sessions} sessions</p>
                  <p className={`text-lg font-bold ${s.warning ? 'text-amber-600' : 'text-green-600'}`}>{s.percentage}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CircularProgress({ percentage, warning }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const filled = (percentage / 100) * c;
  const color = warning ? '#f59e0b' : '#22c55e';

  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="28" cy="28" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${filled} ${c - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
