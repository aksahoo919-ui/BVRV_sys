import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function TeacherManualAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]); // [{id, name, roll_number, status}]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    api.get('/teacher/subjects').then(r => {
      setSubjects(r.data);
      if (r.data[0]) setSubjectId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  async function loadRoster() {
    if (!subjectId) return;
    setLoading(true); setError(''); setSavedMsg('');
    try {
      const r = await api.get(`/teacher/students/${subjectId}`);
      setRoster(r.data.map(s => ({ id: s.id, name: s.name, roll_number: s.roll_number, status: 'present' })));
    } catch (e) { setError(e.response?.data?.error || 'Failed to load students'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRoster(); }, [subjectId]);

  function setStatus(id, status) {
    setRoster(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }
  function markAll(status) {
    setRoster(prev => prev.map(s => ({ ...s, status })));
  }

  async function save() {
    if (!subjectId) return;
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const entries = roster.map(s => ({ student_id: s.id, status: s.status }));
      const r = await api.post('/teacher/attendance/manual', { subject_id: subjectId, session_date: date, entries });
      setSavedMsg(`Recorded — ${r.data.present} present, ${r.data.absent} absent.`);
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const presentCount = roster.filter(s => s.status === 'present').length;
  const subject = subjects.find(s => String(s.id) === subjectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manual Attendance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Mark a roster by hand instead of using a PIN session.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : roster.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-800">{subject?.name}</h2>
              <p className="text-xs text-gray-400">{presentCount} / {roster.length} present</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="text-xs px-3 py-1 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">All present</button>
              <button onClick={() => markAll('absent')} className="text-xs px-3 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50">All absent</button>
            </div>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {roster.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                    <td className="px-4 py-2 text-gray-800 font-medium">{s.name}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5 justify-end">
                        <button type="button" onClick={() => setStatus(s.id, 'present')}
                          className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors ${s.status === 'present' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Present</button>
                        <button type="button" onClick={() => setStatus(s.id, 'absent')}
                          className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors ${s.status === 'absent' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Absent</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Attendance'}</button>
            {savedMsg && <span className="text-emerald-600 text-sm font-semibold">✓ {savedMsg}</span>}
          </div>
        </div>
      )}

      {!loading && roster.length === 0 && subjectId && (
        <div className="card text-center py-10 text-gray-400">No students enrolled in this subject.</div>
      )}
    </div>
  );
}
