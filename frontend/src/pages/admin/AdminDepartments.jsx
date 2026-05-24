import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="border-4 border-primary-500 border-t-transparent rounded-full animate-spin w-8 h-8" />
  </div>
);

const empty = { name: '', code: '' };

export default function AdminDepartments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', data }
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/admin/departments');
      setRows(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setFormError(''); setModal({ mode: 'add' }); }
  function openEdit(row) { setForm({ name: row.name, code: row.code }); setFormError(''); setModal({ mode: 'edit', data: row }); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (modal.mode === 'add') {
        await api.post('/admin/departments', form);
      } else {
        await api.patch(`/admin/departments/${modal.data.id}`, form);
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
    if (!window.confirm(`Delete department "${row.name}"?`)) return;
    try {
      await api.delete(`/admin/departments/${row.id}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Departments</h1>
        <button className="btn-primary" onClick={openAdd}>+ Add Department</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 pr-4 font-mono text-primary-700">{row.code}</td>
                  <td className="py-3 pr-4">{row.name}</td>
                  <td className="py-3 pr-4 text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
                  <td className="py-3 flex gap-2 justify-end">
                    <button className="btn-secondary text-xs" onClick={() => openEdit(row)}>Edit</button>
                    <button className="btn-danger text-xs" onClick={() => handleDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-400">No departments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{modal.mode === 'add' ? 'Add Department' : 'Edit Department'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input className="input w-full" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input className="input w-full font-mono" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
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
