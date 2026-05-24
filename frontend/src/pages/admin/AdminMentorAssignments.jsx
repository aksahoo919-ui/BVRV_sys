import React, { useEffect, useState, useMemo } from 'react';
import api from '../../utils/api';

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="border-4 border-primary-500 border-t-transparent rounded-full animate-spin w-8 h-8" />
  </div>
);

export default function AdminMentorAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ student_id: '', mentor_id: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [ar, ur] = await Promise.all([
        api.get('/admin/mentor-assignments'),
        api.get('/admin/users'),
      ]);
      setAssignments(ar.data);
      setUsers(ur.data.filter(u => u.status === 'active'));
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
  const mentors = useMemo(() => users.filter(u => u.role === 'mentor'), [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return assignments;
    return assignments.filter(a =>
      a.student_name?.toLowerCase().includes(q) ||
      a.mentor_name?.toLowerCase().includes(q) ||
      a.student_email?.toLowerCase().includes(q)
    );
  }, [assignments, search]);

  function openModal() { setForm({ student_id: '', mentor_id: '' }); setFormError(''); setModal(true); }

  async function handleAssign(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/admin/mentor-assignments', {
        mentor_id: form.mentor_id,
        student_id: form.student_id,
      });
      setModal(false);
      load();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(a) {
    if (!window.confirm(`Remove mentor assignment for ${a.student_name}?`)) return;
    try {
      await api.delete(`/admin/mentor-assignments/${a.student_id}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Remove failed');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Mentor Assignments</h1>
        <button className="btn-primary" onClick={openModal}>+ Assign Mentor</button>
      </div>

      <input
        className="input w-full max-w-sm"
        placeholder="Search by student or mentor name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Student</th>
                <th className="pb-2 pr-4">Student Email</th>
                <th className="pb-2 pr-4">Mentor</th>
                <th className="pb-2 pr-4">Mentor Email</th>
                <th className="pb-2 pr-4">Assigned</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.student_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium">{a.student_name}</td>
                  <td className="py-3 pr-4 text-gray-600">{a.student_email}</td>
                  <td className="py-3 pr-4">{a.mentor_name}</td>
                  <td className="py-3 pr-4 text-gray-600">{a.mentor_email}</td>
                  <td className="py-3 pr-4 text-gray-500">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}</td>
                  <td className="py-3">
                    <button className="btn-danger text-xs" onClick={() => handleRemove(a)}>Remove</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">No assignments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Assign Mentor</h2>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <select className="input w-full" required value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mentor</label>
                <select className="input w-full" required value={form.mentor_id} onChange={e => setForm(f => ({ ...f, mentor_id: e.target.value }))}>
                  <option value="">Select mentor…</option>
                  {mentors.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
                </select>
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Assign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
