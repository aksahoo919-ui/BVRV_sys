import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'];

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function computeDays(from, to) {
  if (!from || !to) return '—';
  const a = new Date(from);
  const b = new Date(to);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : '—';
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ReasonCell({ reason }) {
  const [expanded, setExpanded] = useState(false);
  if (!reason) return <span className="text-gray-400">—</span>;
  const short = reason.length > 60;
  return (
    <span>
      {expanded || !short ? reason : reason.slice(0, 60) + '…'}
      {short && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-1 text-primary-600 hover:underline text-xs"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </span>
  );
}

export default function AdminLeaveRequests() {
  const [tab, setTab] = useState('pending');
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/admin/leave-requests');
      setAllRows(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAction(id, status) {
    setActing(id);
    setError('');
    try {
      await api.patch(`/admin/leave-requests/${id}`, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${status} request.`);
    } finally {
      setActing(null);
    }
  }

  const rows = tab === 'all' ? allRows : allRows.filter(r => r.status === tab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            {t !== 'all' && !loading && (
              <span className="ml-1.5 text-xs">
                ({allRows.filter(r => r.status === t).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">No leave requests found.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">From</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Days</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reviewed By</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${row.status === 'pending' ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 whitespace-nowrap">{row.student_name || '—'}</p>
                      {row.student_email && (
                        <p className="text-xs text-gray-400">{row.student_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.from_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.to_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">
                      {computeDays(row.from_date, row.to_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <ReasonCell reason={row.reason} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`badge capitalize ${STATUS_BADGE[row.status] || 'bg-gray-100 text-gray-600'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {row.reviewed_by_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(row.id, 'approved')}
                            disabled={acting === row.id}
                            className="btn-primary text-xs py-1 px-3"
                          >
                            {acting === row.id ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleAction(row.id, 'rejected')}
                            disabled={acting === row.id}
                            className="btn-danger text-xs py-1 px-3"
                          >
                            {acting === row.id ? '…' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
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
