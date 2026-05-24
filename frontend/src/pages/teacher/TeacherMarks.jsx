import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const ASSESSMENT_TYPES = [
  { value: 'internal', label: 'Internal' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'final', label: 'Final' },
];

function Spinner() {
  return <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function StepBadge({ n, active, done, label }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'text-primary-700' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
        ${active ? 'border-primary-600 bg-primary-50' : done ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-white'}`}>
        {done ? '✓' : n}
      </span>
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </div>
  );
}

export default function TeacherMarks() {
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [ctx, setCtx] = useState({ subject_id: '', academic_year_id: '', assessment_type: 'internal', max_marks: '' });
  const [step, setStep] = useState(1);
  const [students, setStudents] = useState([]); // [{id, name, roll_number, scored_marks}]
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/subjects').then(r => {
      setSubjects(r.data);
      if (r.data[0]) setCtx(c => ({ ...c, subject_id: String(r.data[0].id) }));
    }).catch(() => {});
    api.get('/teacher/academic-years').then(r => {
      setAcademicYears(r.data);
      const cur = r.data.find(ay => ay.is_current) || r.data[0];
      if (cur) setCtx(c => ({ ...c, academic_year_id: String(cur.id) }));
    }).catch(() => {});
  }, []);

  async function loadStudents(e) {
    e.preventDefault();
    setError('');
    if (!ctx.subject_id || !ctx.academic_year_id || !ctx.assessment_type || !ctx.max_marks) {
      setError('All fields are required.'); return;
    }
    setLoadingStudents(true);
    try {
      const perf = await api.get(`/teacher/students/${ctx.subject_id}?academic_year_id=${ctx.academic_year_id}`);
      const existing = await api.get(`/teacher/marks/${ctx.subject_id}?academic_year_id=${ctx.academic_year_id}`)
        .then(r => r.data).catch(() => []);
      const marksMap = {};
      for (const m of existing) {
        if (m.assessment_type === ctx.assessment_type) marksMap[m.student_id] = m;
      }
      setStudents(perf.data.map(s => ({
        id: s.id, name: s.name, roll_number: s.roll_number || '',
        scored_marks: marksMap[s.id]?.scored_marks != null ? String(marksMap[s.id].scored_marks) : '',
        mark_id: marksMap[s.id]?.id || null,
      })));
      setStep(2); setSavedCount(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load students.');
    } finally { setLoadingStudents(false); }
  }

  function setScore(idx, val) {
    setStudents(prev => prev.map((s, i) => i === idx ? { ...s, scored_marks: val } : s));
  }

  async function handleSave(e) {
    e.preventDefault(); setError('');
    const max = Number(ctx.max_marks);
    const entries = students.map(s => ({ student_id: s.id, scored_marks: Number(s.scored_marks) }))
      .filter(s => s.scored_marks >= 0 && !isNaN(s.scored_marks));
    if (entries.some(e => e.scored_marks > max)) { setError(`No score can exceed max marks (${max}).`); return; }
    setSaving(true);
    try {
      const r = await api.post('/teacher/marks', {
        subject_id: ctx.subject_id, academic_year_id: ctx.academic_year_id,
        assessment_type: ctx.assessment_type, max_marks: max, entries,
      });
      setSavedCount(r.data?.saved ?? entries.length);
    } catch (err) { setError(err.response?.data?.error || 'Save failed.'); }
    finally { setSaving(false); }
  }

  const subjectName = subjects.find(s => String(s.id) === ctx.subject_id)?.name || '';
  const ayObj = academicYears.find(ay => String(ay.id) === ctx.academic_year_id);
  const ayLabel = ayObj ? ayObj.label + (ayObj.is_current ? ' (Current)' : '') : '';

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Marks Entry</h1>

      <div className="flex items-center gap-3 mb-6 text-sm">
        <StepBadge n={1} active={step===1} done={step>1} label="Select Context" />
        <div className="h-px flex-1 bg-gray-200" />
        <StepBadge n={2} active={step===2} done={false} label="Enter Marks" />
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {step === 1 && (
        <div className="card max-w-lg">
          <h2 className="font-semibold text-gray-800 mb-4">Configure</h2>
          <form onSubmit={loadStudents} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select className="input" required value={ctx.subject_id} onChange={e => setCtx(c => ({...c, subject_id: e.target.value}))}>
                <option value="">— Select —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select className="input" required value={ctx.academic_year_id} onChange={e => setCtx(c => ({...c, academic_year_id: e.target.value}))}>
                <option value="">— Select —</option>
                {academicYears.map(ay => (
                  <option key={ay.id} value={ay.id}>{ay.label}{ay.is_current ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Type</label>
              <select className="input" value={ctx.assessment_type} onChange={e => setCtx(c => ({...c, assessment_type: e.target.value}))}>
                {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
              <input type="number" className="input" min={1} required placeholder="e.g. 50" value={ctx.max_marks} onChange={e => setCtx(c => ({...c, max_marks: e.target.value}))} />
            </div>
            <button type="submit" disabled={loadingStudents} className="btn-primary w-full">
              {loadingStudents ? 'Loading students…' : 'Load Students →'}
            </button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Enter Marks</h2>
              <p className="text-xs text-gray-400 mt-0.5">{subjectName} · {ASSESSMENT_TYPES.find(t=>t.value===ctx.assessment_type)?.label} · Max: {ctx.max_marks} · {ayLabel}</p>
            </div>
            <button className="btn-secondary text-sm" onClick={() => { setStep(1); setStudents([]); setSavedCount(null); }}>← Change</button>
          </div>

          {savedCount !== null && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              ✓ Saved marks for <strong>{savedCount}</strong> student{savedCount!==1?'s':''}.
            </div>
          )}

          {loadingStudents ? <Spinner /> : (
            <form onSubmit={handleSave}>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Score / {ctx.max_marks}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-8 text-gray-400">No students enrolled in this subject.</td></tr>
                    )}
                    {students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                        <td className="px-4 py-2 text-gray-800 font-medium">{s.name}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number" min={0} max={Number(ctx.max_marks)} step={0.5}
                            className="input py-1 px-2 text-sm w-24 text-right"
                            placeholder="—"
                            value={s.scored_marks}
                            onChange={e => setScore(i, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving || students.length===0} className="btn-primary">
                  {saving ? 'Saving…' : 'Save All Marks'}
                </button>
                {savedCount !== null && <span className="text-emerald-600 text-sm font-semibold">✓ {savedCount} saved</span>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
