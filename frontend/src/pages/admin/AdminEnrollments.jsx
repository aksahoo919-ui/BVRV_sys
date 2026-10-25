import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { classLabel, semesterChoices, inSemester } from '../../utils/classLabel';
import SemesterSelect from '../../components/SemesterSelect';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

// Enrollments per class (e.g. "Bhakti Shastri 1 - English"), current semester by default.
export default function AdminEnrollments() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [sem, setSem] = useState('current');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [q, setQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/admin/subjects'), api.get('/admin/users')])
      .then(([sr, ur]) => {
        const list = sr.data.filter(s => s.code !== 'TEST')
          .sort((a, b) => (a.course_name || '').localeCompare(b.course_name || '') || a.code.localeCompare(b.code));
        setClasses(list);
        setStudents(ur.data.filter(u => u.role === 'student' && u.status === 'active').sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        const first = list.find(s => s.semester_is_current) || list[0];
        if (first) setSubjectId(String(first.id));
      })
      .catch(() => setError('Failed to load data'));
  }, []);

  function load() {
    if (!subjectId) return;
    setLoading(true);
    api.get(`/admin/subjects/${subjectId}/mentor-assignments`)
      .then(r => setRows(r.data))
      .catch(() => setError('Failed to load enrollments'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { setNotice(''); load(); }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // grouped by course for the dropdown
  const groups = useMemo(() => {
    const m = new Map();
    for (const s of classes) {
      if (!inSemester(s, sem) && String(s.id) !== subjectId) continue;
      const k = s.course_name || 'Other';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    return [...m.entries()];
  }, [classes, sem, subjectId]);
  const current = classes.find(s => String(s.id) === subjectId);

  async function handleEnroll(e) {
    e.preventDefault();
    if (!selectedStudent) return;
    setEnrolling(true);
    setEnrollError('');
    try {
      // same route as All Users > Course > Add: the student's BV leader comes along
      await api.post(`/admin/users/${selectedStudent}/classes`, { to_subject_id: subjectId });
      const who = students.find(s => s.id === selectedStudent)?.name;
      setModal(false); setSelectedStudent(''); setQ('');
      setNotice(`Enrolled ${who} in ${current ? classLabel(current, { semester: false }) : 'the class'}.`);
      load();
    } catch (err) {
      setEnrollError(err.response?.data?.error || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  }

  const enrolledIds = new Set(rows.map(r => String(r.student_id)));
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return students.filter(s => !enrolledIds.has(String(s.id)) &&
      [s.name, s.phone, s.email].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 30);
  }, [q, students, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = students.find(s => s.id === selectedStudent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Course Enrollments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Students in each class, e.g. Bhakti Shastri 1 - English · Sem 2. Pick Sem 1 or Sem 2 to see that semester's classes.</p>
        </div>
        <button className="btn-primary" onClick={() => { setModal(true); setEnrollError(''); setSelectedStudent(''); setQ(''); }} disabled={!subjectId}>
          + Enroll Student
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{notice}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
        <div className="flex items-center gap-4 flex-wrap">
          <select className="input max-w-lg" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select course —</option>
            {groups.map(([course, list]) => (
              <optgroup key={course} label={course}>
                {list.map(s => <option key={s.id} value={s.id}>{classLabel(s)}</option>)}
              </optgroup>
            ))}
          </select>
          <SemesterSelect value={sem} onChange={setSem} options={semesterChoices(classes)} />
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            {current ? `${classLabel(current)} · ` : ''}{rows.length} student{rows.length === 1 ? '' : 's'}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Name', 'Email', 'BV Leader'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-500">No students enrolled{!subjectId ? ' — select a course' : ''}.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.student_name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.student_email}</td>
                  <td className="px-4 py-3 text-gray-600">{r.mentor_name || <span className="text-gray-500">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-1">Enroll Student</h2>
            <p className="text-xs text-gray-500 mb-4">{current ? classLabel(current) : ''}</p>
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                {picked ? (
                  <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{picked.name}</p>
                      <p className="text-xs text-gray-500">{picked.phone || picked.email} · {picked.course || 'no class'}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedStudent('')} className="text-xs text-primary-600 hover:underline inline-flex items-center min-h-[24px]">Change</button>
                  </div>
                ) : (
                  <>
                    <input className="input mb-1" placeholder="Type a name, phone or email…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
                    <div className="border border-gray-100 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {q.trim().length < 2 ? <p className="text-xs text-gray-500 px-3 py-2">Type at least 2 letters.</p>
                        : matches.length === 0 ? <p className="text-xs text-gray-500 px-3 py-2">No student found (or already in this class).</p>
                        : matches.map(s => (
                          <button type="button" key={s.id} onClick={() => setSelectedStudent(s.id)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                            <p className="text-sm text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.phone || s.email} · {s.course || 'no class'}</p>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
              {enrollError && <p className="text-red-600 text-sm">{enrollError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={enrolling || !selectedStudent}>
                  {enrolling ? 'Enrolling…' : 'Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
