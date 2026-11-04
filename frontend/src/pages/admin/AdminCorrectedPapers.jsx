import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import CorrectedPapersModal from '../../components/CorrectedPapersModal';

// Admin view of corrected exam papers — approved 04 Nov 2026 (Lakshminadh
// Prabhu's grievance-handling plan). Teachers manage their own students'
// papers from Teacher > Marks History; this page lets admin do the same for
// any subject/course. Students never see this page.

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminCorrectedPapers() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paperMark, setPaperMark] = useState(null);

  useEffect(() => {
    api.get('/admin/subjects').then(r => {
      setSubjects(r.data);
      if (r.data[0]) setSubjectId(String(r.data[0].id));
    }).catch(() => setError('Failed to load subjects'));
  }, []);

  const selectedSubject = subjects.find(s => String(s.id) === subjectId);

  async function load() {
    if (!subjectId) return;
    setLoading(true); setError('');
    try {
      const r = await api.get(`/admin/marks?subject_id=${subjectId}`);
      setMarks(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load marks'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [subjectId]);

  // Group marks by semester + assessment_type, same as the teacher's Marks History page.
  const groups = {};
  for (const m of marks) {
    const sem = m.semester_no || 1;
    const key = `${sem}|${m.assessment_type || 'Other'}`;
    if (!groups[key]) groups[key] = { type: `Sem ${sem} · ${m.assessment_type || 'Other'}`, assessed_on: m.assessed_on, max_marks: m.max_marks, rows: [] };
    groups[key].rows.push(m);
  }
  const grouped = Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Corrected Papers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload, view and replace corrected exam papers against a student's mark entry. Not visible to students.
        </p>
      </div>

      <div className="card flex flex-wrap gap-4">
        <div className="flex-1 min-w-56">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select —</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.course_name ? `${s.course_name} · ` : ''}{s.semester_label ? `${s.semester_label} · ` : ''}{s.code} — {s.name}
              </option>
            ))}
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
        <div className="card text-center py-12 text-gray-500">No marks entered yet for this subject.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(g => (
            <div key={g.type} className="card overflow-x-auto p-0">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <p className="font-semibold text-gray-800 text-sm">
                  {g.type}
                  <span className="ml-2 text-gray-500 font-normal">Max {g.max_marks}</span>
                </p>
                <span className="text-xs text-gray-500">Assessed: {fmtDate(g.assessed_on)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Score / {g.max_marks}</th>
                      <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Corrected Paper</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {g.rows.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-2.5 text-gray-500 font-mono text-xs">{m.roll_number || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-800">{m.student_name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{m.scored_marks}</td>
                        <td className="px-6 py-2.5 text-right">
                          <button
                            onClick={() => setPaperMark(m)}
                            className="text-xs font-medium px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            📎 Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {paperMark && (
        <CorrectedPapersModal
          mark={paperMark}
          apiBase="/admin"
          onClose={() => setPaperMark(null)}
          onMarkUpdated={(markId, newScore) => setMarks(prev => prev.map(x => x.id === markId ? { ...x, scored_marks: newScore } : x))}
        />
      )}
    </div>
  );
}
