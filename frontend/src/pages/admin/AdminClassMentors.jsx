import React, { useEffect, useState, useRef } from 'react';
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

  async function handleImport() {
    const file = importFileRef.current?.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post('/admin/class-mentors/import', form);
      setImportResult(r.data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function downloadImportTemplate() {
    const csv = 'student name,mentor name\nManoj Kumar Sahoo,Vimal Das\nMahesh Pupala,Gita Devi';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'class_mentors_template.csv'; a.click();
  }

  const subject = subjects.find(s => String(s.id) === subjectId);
  const assignedCount = rows.filter(r => r.mentor_id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Class Mentors</h1>
          <p className="text-sm text-gray-400 mt-0.5">Assign a mentor to each student in a class. A class can have many mentors.</p>
        </div>
        <button
          onClick={() => { setShowImport(true); setImportResult(null); }}
          className="btn-primary text-sm"
        >
          Import CSV
        </button>
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

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Import mentor assignments</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Columns: <code className="bg-gray-100 px-1 rounded text-xs">student name, mentor name</code>.
            </p>
            <p className="text-xs text-gray-400 mb-3">Each student is assigned the named mentor across every class they're enrolled in. Names are matched case-insensitively.</p>
            <button onClick={downloadImportTemplate} className="text-xs text-primary-600 hover:underline mb-3 block">Download sample CSV</button>
            <input ref={importFileRef} type="file" accept=".csv" className="input mb-3" />
            {importResult && (
              <div className={`text-sm mb-3 p-3 rounded-lg ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importResult.error
                  ? importResult.error
                  : `Students mapped: ${importResult.students} · Class assignments: ${importResult.assignments} · Skipped: ${importResult.skipped?.length || 0}`}
                {importResult.skipped?.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 max-h-32 overflow-y-auto list-disc list-inside">
                    {importResult.skipped.slice(0, 20).map((s, i) => (
                      <li key={i}>Row {s.row}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleImport} disabled={importing} className="btn-primary flex-1">{importing ? 'Importing…' : 'Import'}</button>
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
