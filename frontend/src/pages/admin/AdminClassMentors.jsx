import React, { useEffect, useState, useRef } from 'react';
import api from '../../utils/api';
import { classLabel, semesterChoices, inSemester, hasSemesters } from '../../utils/classLabel';
import SemesterSelect from '../../components/SemesterSelect';

const fmt = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Semester and teachers of the selected class.
function ClassDetails({ subjectId }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    if (subjectId) api.get(`/admin/subjects/${subjectId}/details`).then(r => setD(r.data)).catch(() => setD(false));
  }, [subjectId]);
  if (!subjectId || d === null) return null;
  if (d === false) return <div className="card text-sm text-gray-500">Could not load the class details.</div>;
  return (
    <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Semester</p>
        {hasSemesters(d) ? (
          <>
            <p className="font-medium text-gray-800">
              {d.course_name ? `${d.course_name} · ` : ''}{d.semester_label}
              {d.is_current
                ? <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>
                : <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Past</span>}
            </p>
            <p className="text-xs text-gray-500">{fmt(d.start_date)} – {fmt(d.end_date)}</p>
            {d.topic && <p className="text-sm text-gray-700 mt-1">Subject: <span className="font-medium">{d.topic}</span></p>}
          </>
        ) : <p className="text-sm text-gray-600">{d.course_name || 'Not in a semester'}{d.semester_id ? <span className="text-gray-500"> · no semesters</span> : null}</p>}
        <p className="text-xs text-gray-500 mt-1">{d.class_days} class day{d.class_days === 1 ? '' : 's'} held{d.last_class ? ` · last ${fmt(d.last_class)}` : ''}</p>
      </div>
      <div className="md:col-span-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Teacher{d.teachers.length === 1 ? '' : 's'}</p>
        {d.teachers.length === 0 ? <p className="text-sm text-gray-500">No teacher assigned (Class Management).</p> : (
          <div className="space-y-2">
            {d.teachers.map(t => (
              <div key={t.id}>
                <p className="font-medium text-gray-800 text-sm">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {[t.phone, t.email && !t.email.endsWith('@noemail.bvrv') ? t.email : null, t.gender].filter(Boolean).join(' · ') || 'No contact details'}
                  {t.timetable ? ` · ${t.timetable}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function AdminClassMentors() {
  const [subjects, setSubjects] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [sem, setSem] = useState('current');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  // CSV import
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef();

  useEffect(() => {
    Promise.all([api.get('/admin/subjects'), api.get('/admin/mentors')])
      .then(([sr, mr]) => {
        setSubjects(sr.data);
        setMentors(mr.data);
        const first = sr.data.find(s => s.semester_is_current) || sr.data[0];
        if (first) setSubjectId(String(first.id));
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

  // dryRun=true only checks the file; false applies it.
  async function handleImport(dryRun) {
    const file = importFileRef.current?.files[0];
    if (!file) { setImportResult({ error: 'Choose a CSV file first' }); return; }
    setImporting(true); setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post(`/admin/class-mentors/import${dryRun ? '?dry_run=1' : ''}`, form);
      setImportResult(r.data);
      if (!dryRun) load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  async function download(path, filename) {
    try {
      const r = await api.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { setImportResult({ error: 'Download failed' }); }
  }

  const subject = subjects.find(s => String(s.id) === subjectId);
  const listed = subjects.filter(s => inSemester(s, sem) || String(s.id) === subjectId);
  const assignedCount = rows.filter(r => r.mentor_id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">BV Leader Assignment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign a BV Leader to each student in a class. A class can have many BV Leaders. Each semester has its own classes.</p>
        </div>
        <button
          onClick={() => { setShowImport(true); setImportResult(null); }}
          className="btn-primary text-sm"
        >
          Bulk map from CSV
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class (Subject)</label>
        <div className="flex items-center gap-4 flex-wrap">
          <select className="input max-w-md" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select subject —</option>
            {listed.map(s => (
              <option key={s.id} value={s.id}>{classLabel(s)}</option>
            ))}
          </select>
          <SemesterSelect value={sem} onChange={setSem} options={semesterChoices(subjects)} />
        </div>
      </div>

      <ClassDetails subjectId={subjectId} />

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            {rows.length} students · {assignedCount} with a BV Leader
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">BV Leader</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-500">No students enrolled in this class.</td></tr>
              ) : rows.map(r => (
                <tr key={r.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.roll_number || '—'}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{r.student_name}</p>
                    <p className="text-xs text-gray-500">{r.student_email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="input py-1 text-sm max-w-xs"
                      value={r.mentor_id || ''}
                      disabled={savingId === r.student_id}
                      onChange={e => setMentor(r.student_id, e.target.value)}
                    >
                      <option value="">— No BV Leader —</option>
                      {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {savingId === r.student_id ? <span className="text-xs text-gray-500">Saving…</span>
                      : savedId === r.student_id ? <span className="text-xs text-temple-700 font-semibold inline-flex items-center min-h-[24px]">✓ Saved</span>
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Bulk map students to BV Leaders</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <ol className="text-sm text-gray-600 space-y-3 mb-4 list-decimal list-inside">
              <li>
                Download the BV Leader names (spell them exactly like this).
                <button onClick={() => download('/admin/class-mentors/leaders.csv', 'bv_leaders.csv')} className="block text-xs text-primary-600 hover:underline mt-1 ml-5 inline-flex items-center min-h-[24px]">⬇ BV Leader list (CSV)</button>
              </li>
              <li>
                Download the student list, then type each student's BV Leader in column 2 (<code className="bg-gray-100 px-1 rounded text-xs">bv leader name</code>). Leave it blank to skip a student.
                <button onClick={() => download('/admin/class-mentors/template.csv', 'student_bv_leader_mapping.csv')} className="block text-xs text-primary-600 hover:underline mt-1 ml-5 inline-flex items-center min-h-[24px]">⬇ Student list with BV Leader column (CSV)</button>
              </li>
              <li>Upload the filled file. <span className="text-gray-500">Check it first — nothing is saved until you click Import.</span></li>
            </ol>
            <p className="text-xs text-gray-500 mb-3">
              Column 1 = student name (or roll number / email), column 2 = BV Leader name (or email). Names are matched ignoring case and extra spaces.
              Each student is mapped to the BV Leader in every class they're enrolled in; an existing mapping is replaced.
            </p>
            <input ref={importFileRef} type="file" accept=".csv,text/csv" className="input mb-3" onChange={() => setImportResult(null)} />
            {importResult && (
              <div className={`text-sm mb-3 p-3 rounded-lg ${importResult.error ? 'bg-red-50 text-red-700' : importResult.dry_run ? 'bg-shyama-50 text-shyama-800' : 'bg-green-50 text-green-700'}`}>
                {importResult.error ? importResult.error : (
                  <>
                    <p className="font-semibold">
                      {importResult.dry_run
                        ? `Ready to map ${importResult.students} student(s) — nothing saved yet.`
                        : `✓ Mapped ${importResult.students} student(s) (${importResult.assignments} class assignments).`}
                    </p>
                    <p className="text-xs mt-1">
                      {importResult.skipped?.length || 0} problem row(s){importResult.blank_rows ? ` · ${importResult.blank_rows} row(s) with no BV Leader ignored` : ''}
                    </p>
                    {Object.keys(importResult.by_leader || {}).length > 0 && (
                      <ul className="text-xs mt-2 max-h-24 overflow-y-auto">
                        {Object.entries(importResult.by_leader).sort().map(([name, n]) => <li key={name}>{name}: {n} student(s)</li>)}
                      </ul>
                    )}
                  </>
                )}
                {importResult.skipped?.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 max-h-40 overflow-y-auto list-disc list-inside">
                    {importResult.skipped.map((s, i) => (
                      <li key={i}>Row {s.row}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => handleImport(true)} disabled={importing} className="btn-secondary flex-1">{importing ? 'Checking…' : 'Check file'}</button>
              <button onClick={() => handleImport(false)} disabled={importing} className="btn-primary flex-1">{importing ? 'Importing…' : 'Import'}</button>
            </div>
            <button onClick={() => setShowImport(false)} className="text-xs text-gray-500 hover:text-gray-600 mt-3 w-full inline-flex items-center min-h-[24px]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
