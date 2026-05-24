import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function InstructorReports() {
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/instructor/subjects').then(r => setSubjects(r.data));
  }, []);

  async function loadReport(subjectId) {
    setLoading(true);
    try {
      const r = await api.get(`/instructor/reports/${subjectId}`);
      setReport(r.data);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setSelected(e.target.value);
    if (e.target.value) loadReport(e.target.value);
    else setReport([]);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Attendance Reports</h1>
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
        <select className="input max-w-sm" value={selected} onChange={handleChange}>
          <option value="">— Choose a subject —</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : selected && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Attended</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.below_threshold ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar user={r} />
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.attended}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_sessions}</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${r.below_threshold ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(r.percentage, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${r.below_threshold ? 'text-amber-600' : 'text-green-600'}`}>
                        {r.percentage}%
                      </span>
                    </div>
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

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt="" />;
  return <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">{user.name?.[0]?.toUpperCase()}</div>;
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
