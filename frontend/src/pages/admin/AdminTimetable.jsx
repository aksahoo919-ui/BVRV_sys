import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am-6pm

function timeLabel(h) { return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`; }
function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

export default function AdminTimetable() {
  const [slots, setSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', slot? }
  const [form, setForm] = useState({ subject_id:'', teacher_id:'', day_of_week:0, start_time:'', end_time:'', room:'' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [subjectTeachers, setSubjectTeachers] = useState([]); // instructors assigned to the chosen subject

  async function load() {
    setLoading(true);
    try {
      const [sr, subr, tr] = await Promise.all([
        api.get('/admin/timetable'),
        api.get('/admin/subjects'),
        api.get('/admin/users'),
      ]);
      setSlots(sr.data);
      setSubjects(subr.data);
      setTeachers(tr.data.filter(u => u.role === 'teacher' && u.status === 'active'));
    } catch { setError('Failed to load timetable'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Load only the teachers assigned to the selected subject
  useEffect(() => {
    if (!modal || !form.subject_id) { setSubjectTeachers([]); return; }
    api.get(`/admin/classes/${form.subject_id}/members`)
      .then(r => setSubjectTeachers(r.data.instructors || []))
      .catch(() => setSubjectTeachers([]));
  }, [form.subject_id, modal]);

  function openNew(day, hour) {
    const h = String(hour).padStart(2,'0');
    setForm({ subject_id:'', teacher_id:'', day_of_week: day, start_time:`${h}:00`, end_time:`${String(hour+1).padStart(2,'0')}:00`, room:'' });
    setFormError('');
    setModal({ mode:'add' });
  }

  function openEdit(slot) {
    setForm({ subject_id: String(slot.subject_id), teacher_id: String(slot.teacher_id),
               day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time, room: slot.room || '' });
    setFormError('');
    setModal({ mode:'edit', slot });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, day_of_week: Number(form.day_of_week) };
      if (modal.mode === 'add') await api.post('/admin/timetable', payload);
      else await api.patch(`/admin/timetable/${modal.slot.id}`, payload);
      setModal(null);
      await load();
    } catch (err) { setFormError(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this slot?')) return;
    await api.delete(`/admin/timetable/${id}`).catch(() => {});
    await load();
  }

  // Build grid: grid[day][hour] = slot[]
  const grid = {};
  for (const slot of slots) {
    const d = slot.day_of_week;
    const h = parseInt(slot.start_time?.split(':')[0] || '8');
    if (!grid[d]) grid[d] = {};
    if (!grid[d][h]) grid[d][h] = [];
    grid[d][h].push(slot);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Timetable</h1>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Weekly grid */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="py-2 px-3 text-left w-16 font-medium text-slate-300">Time</th>
              {DAYS.map((d,i) => <th key={i} className="py-2 px-2 text-center font-medium">{d.slice(0,3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(h => (
              <tr key={h} className="border-t border-gray-100">
                <td className="py-1 px-3 text-gray-400 font-mono text-xs align-top">{timeLabel(h)}</td>
                {DAYS.map((_, d) => {
                  const cellSlots = grid[d]?.[h] || [];
                  return (
                    <td key={d} className="py-1 px-1 align-top min-h-[40px] border-l border-gray-50">
                      {cellSlots.map(s => (
                        <div key={s.id}
                          className="bg-primary-50 border border-primary-200 rounded px-1.5 py-1 mb-1 cursor-pointer hover:bg-primary-100 group"
                          onClick={() => openEdit(s)}>
                          <p className="font-semibold text-primary-700 truncate">{s.subject_code}</p>
                          <p className="text-gray-500 truncate">{s.teacher_name}</p>
                          {s.room && <p className="text-gray-400">{s.room}</p>}
                          <button
                            className="text-red-400 hover:text-red-600 text-xs hidden group-hover:inline"
                            onClick={e => { e.stopPropagation(); handleDelete(s.id); }}>✕ remove</button>
                        </div>
                      ))}
                      <button
                        className="w-full text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded py-0.5 transition-colors text-lg leading-none"
                        onClick={() => openNew(d, h)}>+</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-sm shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-4">{modal.mode === 'add' ? 'Add Slot' : 'Edit Slot'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select className="input" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                  {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input type="time" className="input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input type="time" className="input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select className="input" required value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value, teacher_id: '' }))}>
                  <option value="">— Select —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                <select className="input" required value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} disabled={!form.subject_id}>
                  <option value="">{!form.subject_id ? '— Select a subject first —' : (subjectTeachers.length ? '— Select —' : 'No teachers assigned to this subject')}</option>
                  {subjectTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room (optional)</label>
                <input className="input" placeholder="e.g. Lab 3" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
