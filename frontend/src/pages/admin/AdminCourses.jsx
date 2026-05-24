import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="border-4 border-primary-500 border-t-transparent rounded-full animate-spin w-8 h-8" />
  </div>
);

const empty = { name: '', code: '', duration_years: 4 };

export default function AdminCourses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/admin/courses');
      setRows(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setFormError(''); setModal({ mode: 'add' }); }
  function openEdit(row) {
    setForm({ name: row.name, code: row.code, duration_years: row.duration_years });
    setFormError('');
    setModal({ mode: 'edit', data: row });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, duration_years: Number(form.duration_years) };
      if (modal.mode === 'add') {
        await api.post('/admin/courses', payload);
      } else {
        await api.patch(`/admin/courses/${modal.data.id}`, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete course "${row.name}"?`)) return;
    try {
      await api.delete(`/admin/courses/${row.id}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Courses</h1>
        <button className="btn-primary" onClick={openAdd}>+ Add Course</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 pr-4 font-mono text-primary-700">{row.code}</td>
                  <td className="py-3 pr-4">{row.name}</td>
                  <td className="py-3 pr-4 text-gray-600">{row.duration_years} yr{row.duration_years !== 1 ? 's' : ''}</td>
                  <td className="py-3 flex gap-2 justify-end">
                    <button className="btn-secondary text-xs" onClick={() => openEdit(row)}>Edit</button>
                    <button className="btn-danger text-xs" onClick={() => handleDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-400">No courses yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{modal.mode === 'add' ? 'Add Course' : 'Edit Course'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input className="input w-full" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input className="input w-full font-mono" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration (years)</label>
                <input className="input w-full" type="number" min={1} max={10} required value={form.duration_years} onChange={e => setForm(f => ({ ...f, duration_years: e.target.value }))} />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <div className="flex gap-2 justify-end pt-2">
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
