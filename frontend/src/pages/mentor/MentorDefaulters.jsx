import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function MentorDefaulters() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [defaulters, setDefaulters] = useState([]);
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mentor/subjects').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const q = subjectId ? `?subject_id=${subjectId}` : '';
      const r = await api.get(`/mentor/defaulters${q}`);
      setDefaulters(r.data.defaulters || []);
      setThreshold(r.data.threshold ?? 75);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [subjectId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Defaulters</h1>
        <p className="text-sm text-gray-400 mt-0.5">Students below {threshold}% attendance in your weekly classes.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class (Subject)</label>
        <select className="input max-w-md" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">All my classes</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {defaulters.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-emerald-600">🎉 No defaulters.</td></tr>
              ) : defaulters.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.subject_codes || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      {s.attendance_percentage}% ({s.attended_sessions}/{s.total_sessions})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
