import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

function GradeBadge({ pct }) {
  if (pct == null) return <span className="text-gray-400">—</span>;
  const p = Number(pct);
  if (p >= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">S</span>;
  if (p >= 80) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">A</span>;
  if (p >= 70) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">B</span>;
  if (p >= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">C</span>;
  if (p >= 50) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">D</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">F</span>;
}

// Sortable columns: value per row (empty values always go last)
const COLUMNS = [
  { key: 'roll', label: 'Roll No', get: s => s.roll_number || null },
  { key: 'name', label: 'Student', get: s => s.name || null },
  { key: 'leader', label: 'BV Leader', get: s => s.current_mentor_name || null },
  { key: 'att', label: 'Attendance', get: s => Number(s.attendance_pct) },
  { key: 'marks', label: 'Marks %', get: s => (s.marks_percentage == null ? null : Number(s.marks_percentage)) },
  { key: 'grade', label: 'Grade', get: s => (s.marks_percentage == null ? null : Number(s.marks_percentage)) },
  { key: 'status', label: 'Status', get: s => (s.below_threshold ? 'Low Att.' : 'OK') },
];

export default function TeacherStudentPerformance() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  useEffect(() => {
    api.get('/teacher/subjects').then(r => { setSubjects(r.data); if (r.data[0]) setSubjectId(String(r.data[0].id)); }).catch(() => {});
  }, []);

  const selectedSubject = subjects.find(s => String(s.id) === subjectId);
  const academicYearId = selectedSubject?.academic_year_id || '';

  async function load() {
    if (!subjectId) return;
    setLoading(true); setError('');
    try {
      const q = academicYearId ? `?academic_year_id=${academicYearId}` : '';
      const r = await api.get(`/teacher/students/${subjectId}${q}`);
      setStudents(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [subjectId]);

  const subjectName = selectedSubject?.name || '';

  const rows = useMemo(() => {
    const get = COLUMNS.find(c => c.key === sort.key)?.get;
    if (!get) return students;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...students].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), 'en', { sensitivity: 'base', numeric: true }) * dir;
    });
  }, [students, sort]);
  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Student Performance</h1>

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

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {COLUMNS.map(c => (
                  <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
                      {c.label}
                      <span className={`text-[10px] ${sort.key === c.key ? 'text-gray-700' : 'text-gray-300'}`}>
                        {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  {subjectId ? 'No students found.' : 'Select a subject to view performance.'}
                </td></tr>
              ) : rows.map(s => {
                const attPct = Number(s.attendance_pct);
                const marksPct = s.marks_percentage;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.current_mentor_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${attPct>=75?'bg-emerald-500':attPct>=50?'bg-amber-400':'bg-red-400'}`}
                               style={{width:`${Math.min(attPct,100)}%`}} />
                        </div>
                        <span className={`text-xs font-semibold ${attPct>=75?'text-emerald-600':attPct>=50?'text-amber-600':'text-red-600'}`}>
                          {attPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{marksPct != null ? `${marksPct}%` : '—'}</td>
                    <td className="px-4 py-3"><GradeBadge pct={marksPct} /></td>
                    <td className="px-4 py-3">
                      {s.below_threshold
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">⚠ Low Att.</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 font-medium">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
