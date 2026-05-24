import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../utils/api';

const PAGE_SIZE = 50;

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function truncateUUID(id) {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return id.slice(0, 8) + '…';
}

function truncateMeta(meta) {
  if (!meta) return '—';
  try {
    const str = typeof meta === 'string' ? meta : JSON.stringify(meta);
    return str.length > 60 ? str.slice(0, 60) + '…' : str;
  } catch {
    return '—';
  }
}

export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters (client-side)
  const [actorSearch, setActorSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/admin/audit-logs', { params: { limit: PAGE_SIZE, offset: off } });
      setRows(r.data.rows || []);
      setTotal(r.data.total || 0);
      setOffset(off);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  // Auto-refresh toggle
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(offset), 30000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, offset, load]);

  // Unique entity types from current page
  const entityTypes = [...new Set(rows.map(r => r.entity_type).filter(Boolean))];

  // Client-side filtered rows
  const filtered = rows.filter(r => {
    const matchActor = actorSearch
      ? (r.actor_name || '').toLowerCase().includes(actorSearch.toLowerCase())
      : true;
    const matchType = entityTypeFilter ? r.entity_type === entityTypeFilter : true;
    return matchActor && matchType;
  });

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <button
          onClick={() => setAutoRefresh(a => !a)}
          className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${
            autoRefresh
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {autoRefresh ? '⏸ Auto-refresh on (30s)' : '▶ Auto-refresh off'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Search actor name…"
          value={actorSearch}
          onChange={e => setActorSearch(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={entityTypeFilter}
          onChange={e => setEntityTypeFilter(e.target.value)}
        >
          <option value="">All entity types</option>
          {entityTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(actorSearch || entityTypeFilter) && (
          <button
            onClick={() => { setActorSearch(''); setEntityTypeFilter(''); }}
            className="btn-secondary text-sm"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Actor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Entity Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Entity ID</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        No audit logs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{row.actor_name || '—'}</p>
                          {row.actor_email && (
                            <p className="text-xs text-gray-400">{row.actor_email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {row.action || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.entity_type ? (
                            <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {row.entity_type}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {truncateUUID(row.entity_id)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs font-mono">
                          {truncateMeta(row.metadata)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>
              {total === 0 ? 'No records' : `Showing ${from}–${to} of ${total}`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                onClick={() => load(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
