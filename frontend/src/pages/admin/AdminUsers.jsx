import React, { useEffect, useState, useRef } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};
const ROLE_COLORS = {
  admin:   'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  mentor:  'bg-teal-100 text-teal-700',
  student: 'bg-green-100 text-green-700',
};
const ROLE_LABEL = { mentor: 'BV Leader', teacher: 'Teacher', student: 'Student', admin: 'Admin' };
const roleLabel = (r) => ROLE_LABEL[r] || r || '—';

export default function AdminUsers() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]   = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch]         = useState('');

  // Participant import (course sheet)

  // Bulk delete by role
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkRole, setBulkRole] = useState('student');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  // Edit email
  // Edit user (email / phone / role)
  const [editTarget, setEditTarget] = useState(null); // user object
  const [editForm, setEditForm] = useState({ email: '', phone: '', role: '', username: '', password: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Add user
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', role: 'student', email: '', phone: '' });
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState('');

  // Dual role
  const [dualTarget, setDualTarget] = useState(null); // user object
  const [savingDual, setSavingDual] = useState(false);
  const [dualError, setDualError] = useState('');

  // Confirm-delete modal
  const [deleteTarget, setDeleteTarget] = useState(null); // user object
  const [deleting, setDeleting]         = useState(false);
  const [actionError, setActionError]   = useState('');
  const [loadError, setLoadError]       = useState('');

  const fileRef = useRef();

  async function load() {
    setLoadError('');
    try {
      const r = await api.get('/admin/users');
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Bulk import ──────────────────────────────────────────────────────────
  async function handleImport() {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post('/admin/users/bulk-import', form);
      setImportResult(r.data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv =
      'name,email,role,phone number,course name,language\n' +
      'John Doe,john@example.com,student,9876543210,Foundation 1,English\n' +
      'Ravi Kumar,ravi@example.com,student,9876511111,Bhakti Shastri 2,Telugu\n' +
      'Jane Smith,jane@example.com,teacher,9876500000,,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'import_template.csv'; a.click();
  }

  // ── Add user ───────────────────────────────────────────────────────────────
  async function handleAddUser() {
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    setAddingUser(true);
    setAddError('');
    try {
      await api.post('/admin/users', {
        name: addForm.name.trim(),
        role: addForm.role,
        email: addForm.email.trim() || null,
        phone: addForm.phone.trim() || null,
      });
      setShowAdd(false);
      setAddForm({ name: '', role: 'student', email: '', phone: '' });
      load();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  }

  async function resetPasswordToDefault() {
    if (!editTarget) return;
    if (!window.confirm(`Reset ${editTarget.name}'s password to the default (1896)?`)) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await api.patch(`/admin/users/${editTarget.id}/reset-password`);
      setEditForm(f => ({ ...f, password: '' }));
      setEditError('');
      alert('Password reset to default (1896).');
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Edit user (email / phone / role) ────────────────────────────────────────
  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const payload = {
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        username: editForm.username.trim(),
      };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await api.patch(`/admin/users/${editTarget.id}`, payload);
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Dual role ─────────────────────────────────────────────────────────────
  async function saveDual(secondary_role) {
    if (!dualTarget) return;
    setSavingDual(true);
    setDualError('');
    try {
      await api.patch(`/admin/users/${dualTarget.id}/secondary-role`, { secondary_role });
      setDualTarget(null);
      load();
    } catch (err) {
      setDualError(err.response?.data?.error || 'Failed to update');
    } finally {
      setSavingDual(false);
    }
  }

  // ── Bulk delete by role ────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setBulkDeleting(true);
    setBulkResult('');
    try {
      const r = await api.post('/admin/users/bulk-delete', { role: bulkRole });
      setBulkResult(`Deleted ${r.data.deleted} ${bulkRole}(s).`);
      load();
    } catch (err) {
      setBulkResult(err.response?.data?.error || 'Delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  // ── Suspend / Reactivate ─────────────────────────────────────────────────
  async function handleSuspend(user) {
    setActionError('');
    try {
      if (user.status === 'suspended') {
        await api.patch(`/admin/users/${user.id}/approve`);
      } else {
        await api.patch(`/admin/users/${user.id}/suspend`);
      }
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action failed');
    }
  }

  // ── Permanent delete ─────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  const visible = users.filter(u => {
    if (filterRole && u.role !== filterRole && u.secondary_role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">All Users</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowAdd(true); setAddError(''); }} className="btn-primary text-sm">+ Add User</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">Bulk Import</button>
          <button onClick={() => { setShowBulkDelete(true); setBulkResult(''); }} className="text-sm font-semibold py-2 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Bulk Delete</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input text-sm max-w-xs"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input text-sm"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="mentor">BV Leaders</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {loadError}
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-600 mb-3">{actionError}</p>
      )}

      {/* Bulk import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Bulk Import Users</h2>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">CSV columns: <code className="bg-gray-100 px-1 rounded">name, email, role, phone number, course name, language</code></p>
            <p className="text-xs text-gray-400 mb-3">Only name &amp; role are required — email, phone, course name &amp; language are optional. Rows without an email still import (a placeholder is generated). If a student row has course + language, they're auto-enrolled into that subject. Two rows with the same email as teacher and BV Leader automatically get a dual role.</p>
            <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline mb-3 block">Download template CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="input mb-3" />
            {importResult && (
              <div className={`text-sm mb-3 p-3 rounded-lg ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importResult.error || `Imported: ${importResult.imported}${importResult.enrolled != null ? ` | Enrolled: ${importResult.enrolled}` : ''} | Skipped: ${importResult.skipped?.length || 0}`}
                {importResult.skipped?.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 max-h-40 overflow-y-auto list-disc list-inside">
                    {importResult.skipped.map((s, i) => (
                      <li key={i}>Row {s.row}{s.email ? ` (${s.email})` : ''}: {s.reason}</li>
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

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">⚠</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Bulk delete users</h2>
                <p className="text-sm text-gray-500">Permanently removes ALL users of a role.</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role to delete</label>
            <select className="input mb-3" value={bulkRole} onChange={e => setBulkRole(e.target.value)}>
              <option value="student">All Students</option>
              <option value="mentor">All BV Leaders</option>
              <option value="teacher">All Teachers</option>
            </select>
            <p className="text-xs text-red-600 mb-3">This cannot be undone. Admins are never affected.</p>
            {bulkResult && <p className="text-sm mb-3 text-gray-700">{bulkResult}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : `Delete all ${bulkRole}s`}
              </button>
              <button onClick={() => setShowBulkDelete(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Add User</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input mb-3" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select className="input mb-3" value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="mentor">BV Leader</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="email" className="input mb-3" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input mb-3" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddUser} disabled={addingUser || !addForm.name.trim()} className="btn-primary flex-1">
                {addingUser ? 'Adding…' : 'Add User'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Edit user</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">{editTarget.name}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className="input mb-3" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} placeholder="username" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="text" className="input mb-1" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep unchanged" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Default password is <code className="bg-gray-100 px-1 rounded">1896</code>.</p>
              <button type="button" onClick={resetPasswordToDefault} disabled={savingEdit} className="text-xs font-medium text-amber-700 hover:underline">Reset to 1896</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input mb-3" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input mb-3" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input mb-3" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="mentor">BV Leader</option>
            </select>
            <p className="text-xs text-gray-400 mb-3">A real email lets this person sign in with Google.</p>
            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit || !editForm.email.trim()} className="btn-primary flex-1">
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Dual role modal */}
      {dualTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Dual role assignment</h2>
              <button onClick={() => setDualTarget(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">{dualTarget.name}</p>
            <p className="text-xs text-gray-400 mb-4">
              Primary role: <span className="font-medium text-gray-700">{roleLabel(dualTarget.role)}</span>
              {dualTarget.secondary_role && (
                <> · Current secondary: <span className="font-medium text-gray-700">{roleLabel(dualTarget.secondary_role)}</span></>
              )}
            </p>
            {dualError && <p className="text-sm text-red-600 mb-3">{dualError}</p>}
            <div className="space-y-2">
              {dualTarget.role === 'teacher' && (
                <button
                  onClick={() => saveDual('mentor')}
                  disabled={savingDual || dualTarget.secondary_role === 'mentor'}
                  className="w-full text-left px-4 py-3 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span className="font-medium text-emerald-700">Add BV Leader role</span>
                  <p className="text-xs text-gray-400 mt-0.5">User will see both Teacher and BV Leader dashboards.</p>
                </button>
              )}
              {dualTarget.role === 'mentor' && (
                <button
                  onClick={() => saveDual('teacher')}
                  disabled={savingDual || dualTarget.secondary_role === 'teacher'}
                  className="w-full text-left px-4 py-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span className="font-medium text-blue-700">Add Teacher role</span>
                  <p className="text-xs text-gray-400 mt-0.5">User will see both Teacher and BV Leader dashboards.</p>
                </button>
              )}
              {dualTarget.secondary_role && (
                <button
                  onClick={() => saveDual(null)}
                  disabled={savingDual}
                  className="w-full text-left px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
                >
                  <span className="font-medium text-red-600">Remove secondary role</span>
                  <p className="text-xs text-gray-400 mt-0.5">User will only access their primary role.</p>
                </button>
              )}
            </div>
            <button onClick={() => setDualTarget(null)} className="btn-secondary w-full mt-3">Close</button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">⚠</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Remove user permanently?</h2>
                <p className="text-sm text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium text-gray-800">{deleteTarget.name}</p>
              <p className="text-gray-500">{deleteTarget.email}</p>
              <p className="text-gray-400 capitalize">{deleteTarget.role}</p>
            </div>
            {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting ? 'Removing…' : 'Yes, remove'}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setActionError(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <Spinner /> : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No users found.</td></tr>
                )}
                {visible.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`badge ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>{roleLabel(u.role)}</span>
                        {u.secondary_role && (
                          <span className={`badge ${ROLE_COLORS[u.secondary_role] || 'bg-gray-100 text-gray-600'} opacity-70`}>+{roleLabel(u.secondary_role)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-500'}`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex gap-1.5 justify-end">
                          {/* Edit user */}
                          <button
                            onClick={() => { setEditTarget(u); setEditForm({ email: u.email || '', phone: u.phone || '', role: u.role || 'student', username: u.username || '', password: '' }); setEditError(''); }}
                            className="text-xs font-medium py-1 px-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          {/* Dual role — only for teacher/mentor */}
                          {(u.role === 'teacher' || u.role === 'mentor') && (
                            <button
                              onClick={() => { setDualTarget(u); setDualError(''); }}
                              className={`text-xs font-medium py-1 px-2 rounded-md border transition-colors ${
                                u.secondary_role
                                  ? 'border-teal-300 text-teal-700 hover:bg-teal-50'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              Dual
                            </button>
                          )}
                          {/* Suspend / Reactivate */}
                          <button
                            onClick={() => handleSuspend(u)}
                            className={`text-xs font-medium py-1 px-2 rounded-md border transition-colors ${
                              u.status === 'suspended'
                                ? 'border-green-300 text-green-700 hover:bg-green-50'
                                : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => { setDeleteTarget(u); setActionError(''); }}
                            className="text-xs font-medium py-1 px-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {visible.length} of {users.length} users
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt="" />;
  return (
    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
