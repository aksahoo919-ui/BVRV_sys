import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

export default function TeacherDefaulters() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [data, setData] = useState(null); // { threshold, defaulters }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/subjects').then(r => { setSubjects(r.data); if (r.data[0]) setSubjectId(String(r.data[0].id)); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    setLoading(true); setError('');
    api.get(`/teacher/reports/defaulters/${subjectId}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [subjectId]);

  function downloadExcel() {
    // Build CSV download from current data
    if (!data) return;
    const rows = [['Roll No','Name','Attended','Total','Attendance %']];
    for (const s of data.defaulters) rows.push([s.roll_number||'', s.name, s.attended, s.total_sessions, s.percentage]);
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'defaulters.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Defaulter Report</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">Students below {data.threshold}% attendance threshold</p>}
        </div>
        {data?.defaulters?.length > 0 && (
          <button className="btn-secondary text-sm" onClick={downloadExcel}>↓ Export CSV</button>
        )}
      </div>

      <div className="card max-w-xs">
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
        <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">— Select —</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? <Spinner /> : data && (
        data.defaulters.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-500 font-medium">No defaulters!</p>
            <p className="text-gray-400 text-sm mt-1">All students are above {data.threshold}% attendance.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm text-red-700 font-medium">{data.defaulters.length} student{data.defaulters.length!==1?'s':''} below {data.threshold}% threshold</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Roll No','Student','Attended','Total','Attendance %'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.defaulters.map(s => (
                  <tr key={s.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.roll_number||'—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.attended}</td>
                    <td className="px-4 py-3 text-gray-600">{s.total_sessions}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-red-600">{s.percentage ?? 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
