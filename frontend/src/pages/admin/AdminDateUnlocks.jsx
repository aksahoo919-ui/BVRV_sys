import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100  text-red-600',
};

function fmtDate(d) {
  return new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminDateUnlocks() {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // id being actioned

  useEffect(() => {
    setLoading(true);
    api.get('/admin/date-unlocks', { params: { status: tab } })
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleAction(id, action) {
    setBusy(id);
    try {
      await api.patch(`/admin/date-unlocks/${id}`, { action });
      setItems(prev => prev.filter(x => x.id !== id));
    } catch {
      alert('Failed to update. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const tabs = ['pending', 'approved', 'rejected'];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Date Unlock Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Teachers and BV Leaders can request to unlock a past date for attendance marking.
          Approved dates let the coordinator edit attendance even after the 7-day window.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-600" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No {tab} requests.
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {items.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {r.requester_name}
                  <span className="ml-2 text-xs text-gray-500 capitalize">({r.requester_role === 'mentor' ? 'BV Leader' : 'Teacher'})</span>
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Date: <span className="font-medium">{fmtDate(r.unlock_date)}</span>
                </p>
                <p className="text-sm text-gray-500 italic mt-0.5">"{r.reason}"</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Requested {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tab === 'pending' ? (
                  <>
                    <button
                      onClick={() => handleAction(r.id, 'approve')}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'reject')}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || ''}`}>
                    {r.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
