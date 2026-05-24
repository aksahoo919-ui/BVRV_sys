import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="border-4 border-primary-500 border-t-transparent rounded-full animate-spin w-8 h-8" />
  </div>
);

const empty = { academic_year_id: '', number: 1, start_date: '', end_date: '', is_current: false };

export default function AdminSemesters() {
  const [rows, setRows] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [sr, yr] = await Promise.all([
        api.get('/admin/semesters'),
        api.get('/admin/academic-years'),
      ]);
      setRows(sr.data);
      setAcademicYears(yr.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setFormError(''); setModal({ mode: 'add' }); }
  function openEdit(row) {
    setForm({
      academic_year_id: row.academic_year_id,
      number: row.number,
      start_date: row.start_date?.slice(0, 10) || '',
      end_date: row.end_date?.slice(0, 10) || '',
      is_current: !!row.is_current,
    });
    setFormError('');
    setModal({ mode: 'edit', data: row });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, number: Number(form.number), academic_year_id: Number(form.academic_year_id) };
      if (modal.mode === 'add') {
        await api.post('/admin/semesters', payload);
      } else {
        await api.patch(`/admin/semesters/${modal.data.id}`, payload);
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
    if (!window.confirm(`Delete Semester ${row.number}?`)) return;
    try {
      await api.delete(`/admin/semesters/${row.id}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Semesters</h1>
        <button className="btn-primary" onClick={openAdd}>+ Add Semester</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Academic Year</th>
                <th className="pb-2 pr-4">Semester</th>
                <th className="pb-2 pr-4">Start Date</th>
                <th className="pb-2 pr-4">End Date</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-600">{row.year_label}</td>
                  <td className="py-3 pr-4 font-medium">Semester {row.number}</td>
                  <td className="py-3 pr-4 text-gray-600">{row.start_date ? new Date(row.start_date).toLocaleDateString() : '—'}</td>
                  <td className="py-3 pr-4 text-gray-600">{row.end_date ? new Date(row.end_date).toLocaleDateString() : '—'}</td>
                  <td className="py-3 pr-4">
                    {row.is_current
                      ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Current</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-3 flex gap-2 justify-end">
                    <button className="btn-secondary text-xs" onClick={() => openEdit(row)}>Edit</button>
                    <button className="btn-danger text-xs" onClick={() => handleDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">No semesters yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{modal.mode === 'add' ? 'Add Semester' : 'Edit Semester'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Academic Year</label>
                <select className="input w-full" required value={form.academic_year_id} onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
                  <option value="">Select academic year…</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester Number</label>
                <input className="input w-full" type="number" min={1} max={12} required value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input className="input w-full" type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input className="input w-full" type="date" required value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
                <span className="text-sm">Mark as current semester</span>
              </label>
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
