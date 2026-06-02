import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function AdminClassMentors() {
  const [subjects, setSubjects] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/admin/subjects'), api.get('/admin/mentors')])
      .then(([sr, mr]) => {
        setSubjects(sr.data);
        setMentors(mr.data);
        if (sr.data[0]) setSubjectId(String(sr.data[0].id));
      })
      .catch(() => setError('Failed to load subjects / mentors'));
  }, []);

  async function load() {
    if (!subjectId) return;
    setLoading(true); setError('');
    try {
      const r = await api.get(`/admin/subjects/${subjectId}/mentor-assignments`);
      setRows(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [subjectId]);

  async function setMentor(studentId, mentorId) {
    setSavingId(studentId); setError('');
    try {
      await api.post('/admin/class-mentors', { subject_id: subjectId, student_id: studentId, mentor_id: mentorId || null });
      setRows(prev => prev.map(r => r.student_id === studentId
        ? { ...r, mentor_id: mentorId || null, mentor_name: mentors.find(m => m.id === mentorId)?.name || null }
        : r));
      setSavedId(studentId);
      setTimeout(() => setSavedId(null), 1200);
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSavingId(null); }
  }

  const subject = subjects.find(s => String(s.id) === subjectId);
  const assignedCount = rows.filter(r => r.mentor_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Class Mentors</h1>
        <p className="text-sm text-gray-400 mt-0.5">Assign a mentor to each student in a class. A class can have many mentors.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class (Subject)</label>
        <select className="input max-w-md" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">— Select subject —</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}{s.academic_year_label ? ` (${s.academic_year_label})` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-400">
            {rows.length} students · {assignedCount} with a mentor
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mentor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">No students enrolled in this class.</td></tr>
              ) : rows.map(r => (
                <tr key={r.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{r.roll_number || '—'}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{r.student_name}</p>
                    <p className="text-xs text-gray-400">{r.student_email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="input py-1 text-sm max-w-xs"
                      value={r.mentor_id || ''}
                      disabled={savingId === r.student_id}
                      onChange={e => setMentor(r.student_id, e.target.value)}
                    >
                      <option value="">— No mentor —</option>
                      {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {savingId === r.student_id ? <span className="text-xs text-gray-400">Saving…</span>
                      : savedId === r.student_id ? <span className="text-xs text-emerald-600 font-semibold">✓ Saved</span>
                      : null}
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
