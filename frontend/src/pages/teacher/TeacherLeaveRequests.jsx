import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';

const TABS = [
  { value: 'all',      label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function daysBetween(from, to) {
  if (!from || !to) return '—';
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diff = Math.round((d2 - d1) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TeacherLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [acting, setActing] = useState({}); // { [id]: true }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/teacher/leave-requests');
      setRequests(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleAction(id, status) {
    setActing(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      await api.patch(`/teacher/leave-requests/${id}`, { status });
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${status} request.`);
    } finally {
      setActing(prev => ({ ...prev, [id]: false }));
    }
  }

  const filtered = tab === 'all'
    ? requests
    : requests.filter(r => r.status === tab);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
        {pendingCount > 0 && (
          <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
            {pendingCount} pending
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.value
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {t.value === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-medium">
            {tab === 'all' ? 'No leave requests yet.' : `No ${tab} requests.`}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Student
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Dates
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Days
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 max-w-[200px]">
                    Reason
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 align-top">
                    {/* Student */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar user={req} />
                        <div>
                          <p className="font-medium text-gray-900 whitespace-nowrap">
                            {req.student_name}
                          </p>
                          <p className="text-xs text-gray-400">{req.student_email ?? req.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      <p>{fmtDate(req.from_date)}</p>
                      <p className="text-xs text-gray-400">to {fmtDate(req.to_date)}</p>
                    </td>

                    {/* Days count */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {daysBetween(req.from_date, req.to_date)}d
                    </td>

                    {/* Reason (truncated) */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p
                        className="text-gray-600 text-xs leading-relaxed line-clamp-2 break-words"
                        title={req.reason}
                      >
                        {req.reason || '—'}
                      </p>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                          STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'approved')}
                            disabled={!!acting[req.id]}
                            className="btn-primary text-xs py-1 px-3 disabled:opacity-60"
                          >
                            {acting[req.id] ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'rejected')}
                            disabled={!!acting[req.id]}
                            className="btn-danger text-xs py-1 px-3 disabled:opacity-60"
                          >
                            {acting[req.id] ? '…' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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

function Avatar({ user }) {
  const name = user.student_name || user.name || '';
  if (user.avatar_url) {
    return <img src={user.avatar_url} className="w-8 h-8 rounded-full flex-shrink-0" alt="" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
      {name[0]?.toUpperCase()}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
