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

export default function AdminUsers() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]   = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch]         = useState('');

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
    const csv = 'name,email,role\nJohn Doe,john@example.com,student\nJane Smith,jane@example.com,teacher';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'import_template.csv'; a.click();
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
    if (filterRole && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">All Users</h1>
        <button onClick={() => setShowImport(true)} className="btn-primary text-sm">Bulk Import</button>
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
          <option value="mentor">Mentors</option>
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
            <p className="text-sm text-gray-500 mb-3">CSV columns: <code className="bg-gray-100 px-1 rounded">name, email, role</code></p>
            <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline mb-3 block">Download template CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="input mb-3" />
            {importResult && (
              <div className={`text-sm mb-3 p-3 rounded-lg ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importResult.error || `Imported: ${importResult.imported} | Skipped: ${importResult.skipped?.length || 0}`}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleImport} disabled={importing} className="btn-primary flex-1">{importing ? 'Importing…' : 'Import'}</button>
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1">Close</button>
            </div>
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
                      <span className={`badge ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role || '—'}</span>
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
