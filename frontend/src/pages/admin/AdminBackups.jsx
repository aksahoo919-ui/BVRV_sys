import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner({ inline = false }) {
  if (inline) {
    return <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin align-middle" />;
  }
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null || bytes === '') return '—';
  const n = Number(bytes);
  if (isNaN(n)) return '—';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminBackups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function loadBackups() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/admin/backups');
      setBackups(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load backups.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBackups(); }, []);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const r = await api.post('/admin/backups', {}, { responseType: 'blob' });

      // Derive filename from Content-Disposition header or use a default
      const disposition = r.headers['content-disposition'] || '';
      const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
      const filename = match
        ? match[1].trim().replace(/^["']|["']$/g, '')
        : `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      // Trigger browser download
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Reload list to show the new record
      await loadBackups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create backup.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Backups</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary flex items-center gap-2"
        >
          {creating ? (
            <>
              <Spinner inline />
              Creating backup…
            </>
          ) : (
            'Create Backup'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <Spinner />
      ) : backups.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          No backups yet. Click "Create Backup" to generate one.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Filename</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Size</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Created By</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((b, i) => (
                  <tr key={b.id || i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {b.filename || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatBytes(b.size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.created_by_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDateTime(b.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
