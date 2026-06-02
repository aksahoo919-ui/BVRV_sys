import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TeacherMarksHistory() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // inline edit state: { [markId]: editedValue }
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    api.get('/teacher/subjects').then(r => { setSubjects(r.data); if (r.data[0]) setSubjectId(String(r.data[0].id)); }).catch(() => {});
  }, []);

  const selectedSubject = subjects.find(s => String(s.id) === subjectId);
  const academicYearId = selectedSubject?.academic_year_id || '';

  async function load() {
    if (!subjectId) return;
    setLoading(true); setError(''); setEdits({});
    try {
      const q = academicYearId ? `?academic_year_id=${academicYearId}` : '';
      const r = await api.get(`/teacher/marks/${subjectId}${q}`);
      setMarks(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load marks'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [subjectId]);

  async function saveMark(m) {
    const val = edits[m.id];
    if (val == null || val === '') return;
    const scored = Number(val);
    if (isNaN(scored) || scored < 0 || scored > Number(m.max_marks)) {
      setError(`Score must be between 0 and ${m.max_marks}.`); return;
    }
    setSavingId(m.id); setError('');
    try {
      await api.patch(`/teacher/marks/${m.id}`, { scored_marks: scored });
      setMarks(prev => prev.map(x => x.id === m.id ? { ...x, scored_marks: scored } : x));
      setEdits(prev => { const n = { ...prev }; delete n[m.id]; return n; });
      setSavedId(m.id);
      setTimeout(() => setSavedId(null), 1500);
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSavingId(null); }
  }

  // Group marks by assessment_type
  const groups = {};
  for (const m of marks) {
    const key = m.assessment_type || 'Other';
    if (!groups[key]) groups[key] = { type: key, assessed_on: m.assessed_on, max_marks: m.max_marks, rows: [] };
    groups[key].rows.push(m);
  }
  const grouped = Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Marks History</h1>
        <p className="text-sm text-gray-400 mt-0.5">View and edit marks you've entered, grouped by assessment.</p>
      </div>

      <div className="card flex flex-wrap gap-4">
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
          <div className="input bg-gray-50 text-gray-600 flex items-center">
            {selectedSubject?.academic_year_label || '— not set —'}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {loading ? <Spinner /> : grouped.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No marks entered yet for this selection.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(g => (
            <div key={g.type} className="card overflow-hidden p-0">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <p className="font-semibold text-gray-800 text-sm">
                  {g.type}
                  <span className="ml-2 text-gray-400 font-normal">Max {g.max_marks}</span>
                </p>
                <span className="text-xs text-gray-400">Assessed: {fmtDate(g.assessed_on)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Score / {g.max_marks}</th>
                      <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {g.rows.map(m => {
                      const dirty = edits[m.id] != null && String(edits[m.id]) !== String(m.scored_marks);
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-6 py-2.5 text-gray-400 font-mono text-xs">{m.roll_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-800">{m.student_name}</td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number" min={0} max={Number(m.max_marks)} step={0.5}
                              className="input py-1 px-2 text-sm w-24 text-right"
                              value={edits[m.id] != null ? edits[m.id] : (m.scored_marks ?? '')}
                              onChange={e => setEdits(prev => ({ ...prev, [m.id]: e.target.value }))}
                            />
                          </td>
                          <td className="px-6 py-2.5 text-right">
                            {savedId === m.id ? (
                              <span className="text-emerald-600 text-xs font-semibold">✓ Saved</span>
                            ) : (
                              <button
                                onClick={() => saveMark(m)}
                                disabled={!dirty || savingId === m.id}
                                className="text-xs font-medium px-3 py-1 rounded-md border border-primary-300 text-primary-700 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {savingId === m.id ? 'Saving…' : 'Save'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
