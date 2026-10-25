import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const ymd = d => (d ? String(d).slice(0, 10) : '');
const fmt = d => (d ? new Date(`${ymd(d)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
// first day after the given date, and six months on from a start date
const dayAfter = d => { const x = new Date(`${ymd(d)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const sixMonths = d => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 6); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

// Semesters per course. Each semester has its own classes; starting the next
// semester copies the classes, so past semesters keep their history.
export default function AdminCourseSemesters() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(null);   // { id, label, start_date, end_date }
  const [next, setNext] = useState(null);   // { from, label, start_date, end_date, carry_students, carry_teachers }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try { setRows((await api.get('/admin/course-semesters')).data); }
    catch (e) { setError(e.response?.data?.error || 'Failed to load semesters'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const byCourse = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.course_id)) m.set(r.course_id, { course_id: r.course_id, course_name: r.course_name, course_code: r.course_code, semesters: [] });
      m.get(r.course_id).semesters.push(r);
    }
    return [...m.values()];
  }, [rows]);

  async function run(fn, msg) {
    setBusy(true); setFormError(''); setError('');
    try { const r = await fn(); setNotice(typeof msg === 'function' ? msg(r) : msg); await load(); return true; }
    catch (e) { setFormError(e.response?.data?.error || 'Save failed'); return false; }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    const ok = await run(() => api.patch(`/admin/course-semesters/${edit.id}`, edit), 'Semester saved.');
    if (ok) setEdit(null);
  }

  async function startNext() {
    const ok = await run(() => api.post(`/admin/course-semesters/${next.from.id}/next`, next),
      r => `${next.from.course_name} ${r.data.label} started: ${r.data.classes} classes, ${r.data.teachers} teacher links, ${r.data.students} students, ${r.data.bv_leader_links} BV leader links copied.`);
    if (ok) setNext(null);
  }

  async function makeCurrent(s) {
    await run(() => api.post(`/admin/course-semesters/${s.id}/set-current`), `${s.course_name} ${s.label} is now the current semester.`);
  }

  function openNext(course) {
    const last = course.semesters[course.semesters.length - 1];
    const start = dayAfter(last.end_date);
    setFormError('');
    setNext({ from: last, label: '', start_date: start, end_date: sixMonths(start), carry_students: true, carry_teachers: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Course Semesters</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Each course has its own semesters and months. Classes, teachers, students and BV leader links belong to one semester,
          so past semesters stay as they were and show on each student's timeline.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{notice}</div>}

      {loading ? <Spinner /> : byCourse.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">No course has classes yet.</div>
      ) : byCourse.map(c => (
        <div key={c.course_id} className="card p-0 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="mr-auto">
              <p className="font-semibold text-gray-900">{c.course_name}</p>
              <p className="text-xs text-gray-500">{c.course_code} · {c.semesters.length} semester{c.semesters.length === 1 ? '' : 's'}</p>
            </div>
            <button onClick={() => openNext(c)} disabled={busy} className="btn-primary text-sm">Start next semester</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Semester</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Months</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Students</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {c.semesters.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-800">{s.label}</span>
                    {s.is_current && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmt(s.start_date)} – {fmt(s.end_date)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.class_count}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.student_count}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                    {!s.is_current && (
                      <button onClick={() => makeCurrent(s)} disabled={busy} className="text-xs font-medium py-1 px-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">Make current</button>
                    )}
                    <button onClick={() => { setFormError(''); setEdit({ id: s.id, label: s.label, start_date: ymd(s.start_date), end_date: ymd(s.end_date) }); }}
                      className="text-xs font-medium py-1 px-2 rounded-md border border-primary-200 text-primary-600 hover:bg-primary-50">Edit months</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Edit semester</h2>
              <button onClick={() => setEdit(null)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input className="input mb-3" value={edit.label} onChange={e => setEdit(f => ({ ...f, label: e.target.value }))} />
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts</label>
            <input type="date" className="input mb-3" value={edit.start_date} onChange={e => setEdit(f => ({ ...f, start_date: e.target.value }))} />
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
            <input type="date" className="input mb-3" value={edit.end_date} onChange={e => setEdit(f => ({ ...f, end_date: e.target.value }))} />
            {formError && <p className="text-sm text-red-700 mb-3">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEdit(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {next && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-900">Start next semester: {next.from.course_name}</h2>
              <button onClick={() => setNext(null)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Copies the {next.from.class_count} classes of {next.from.label} into a new semester and makes it current.
              {' '}{next.from.label} keeps its attendance and links as history.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-500 font-normal">(blank = next number)</span></label>
            <input className="input mb-3" value={next.label} placeholder={`Sem ${next.from.number + 1}`} onChange={e => setNext(f => ({ ...f, label: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="text-sm font-medium text-gray-700">Starts
                <input type="date" className="input mt-1" value={next.start_date} onChange={e => setNext(f => ({ ...f, start_date: e.target.value }))} />
              </label>
              <label className="text-sm font-medium text-gray-700">Ends
                <input type="date" className="input mt-1" value={next.end_date} onChange={e => setNext(f => ({ ...f, end_date: e.target.value }))} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input type="checkbox" checked={next.carry_teachers} onChange={e => setNext(f => ({ ...f, carry_teachers: e.target.checked }))} />
              Keep the same teachers and timetable
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
              <input type="checkbox" checked={next.carry_students} onChange={e => setNext(f => ({ ...f, carry_students: e.target.checked }))} />
              Move active students to the same classes, with their BV leaders
            </label>
            <p className="text-xs text-gray-500 mb-3">Students who move up to another class can be changed afterwards in All Users &gt; Course.</p>
            {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={startNext} disabled={busy || !next.start_date || !next.end_date} className="btn-primary flex-1">{busy ? 'Starting…' : 'Start semester'}</button>
              <button onClick={() => setNext(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
