import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function AdminEnrollments() {
  const [courses, setCourses] = useState([]);
  const [years, setYears] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [yearId, setYearId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/courses'),
      api.get('/admin/academic-years'),
      api.get('/admin/users'),
    ]).then(([cr, yr, ur]) => {
      setCourses(cr.data);
      setYears(yr.data);
      setStudents(ur.data.filter(u => u.role === 'student' && u.status === 'active').sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      // Auto-select current
      const cur = yr.data.find(y => y.is_current) || yr.data[0];
      if (cur) setYearId(String(cur.id));
      if (cr.data[0]) setCourseId(String(cr.data[0].id));
    }).catch(() => setError('Failed to load data'));
  }, []);

  useEffect(() => {
    if (!courseId || !yearId) return;
    setLoading(true);
    api.get(`/admin/enrollments?course_id=${courseId}&academic_year_id=${yearId}`)
      .then(r => setEnrollments(r.data))
      .catch(() => setError('Failed to load enrollments'))
      .finally(() => setLoading(false));
  }, [courseId, yearId]);

  async function handleEnroll(e) {
    e.preventDefault();
    if (!selectedStudent) return;
    setEnrolling(true);
    setEnrollError('');
    try {
      await api.post('/admin/enroll', { student_id: selectedStudent, course_id: courseId, academic_year_id: yearId });
      setModal(false);
      setSelectedStudent('');
      // Refresh
      const r = await api.get(`/admin/enrollments?course_id=${courseId}&academic_year_id=${yearId}`);
      setEnrollments(r.data);
    } catch (err) {
      setEnrollError(err.response?.data?.error || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  }

  const enrolledIds = new Set(enrollments.map(e => String(e.student_id)));
  const availableStudents = students.filter(s => !enrolledIds.has(String(s.id)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Course Enrollments</h1>
        <button className="btn-primary" onClick={() => { setModal(true); setEnrollError(''); }} disabled={!courseId || !yearId}>
          + Enroll Student
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Filters */}
      <div className="card flex flex-wrap gap-4">
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">— Select course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
          <select className="input" value={yearId} onChange={e => setYearId(e.target.value)}>
            <option value="">— Select year —</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (current)' : ''}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name','Email','Roll No','Classes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enrollments.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">No students enrolled{!courseId || !yearId ? ' — select a course and year' : ''}.</td></tr>
              ) : enrollments.map(e => (
                <tr key={e.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{e.student_name}</td>
                  <td className="px-4 py-3 text-gray-500">{e.student_email}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.roll_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.subject_codes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-sm shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-4">Enroll Student</h2>
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select className="input" required value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                  <option value="">— Select student —</option>
                  {availableStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                </select>
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
