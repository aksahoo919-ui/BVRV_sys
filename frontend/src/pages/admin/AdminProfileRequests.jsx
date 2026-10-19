import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { describeRequest } from '../../components/ChangeRequests';

// BV Leader / course corrections asked for by students from their profile.
// Approve applies the change (same as All Users > Edit / Course); Reject leaves it.

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];
const STATUS_CHIP = {
  pending: 'bg-amber-50 text-amber-700', approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};
const fmt = d => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function AdminProfileRequests() {
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null); // { request, status, note }
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setData(null); setError('');
    api.get('/admin/profile-requests', { params: { status: tab } })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load requests'));
  }, [tab]);
  useEffect(load, [load]);

  async function submitReview() {
    setSaving(true);
    try {
      await api.patch(`/admin/profile-requests/${review.request.id}`, { status: review.status, admin_note: review.note });
      setReview(null);
      load();
    } catch (e) {
      setReview(r => ({ ...r, error: e.response?.data?.error || 'Failed to save' }));
    } finally {
      setSaving(false);
    }
  }

  const counts = data?.counts || {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Profile Requests</h1>
        <p className="text-sm text-gray-400 mt-0.5">BV Leader and course corrections asked for by students. Approve applies the change.</p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.label}{t.key !== 'all' && counts[t.key] ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
      {!data && !error ? <p className="text-sm text-gray-400">Loading…</p> : data && (
        data.requests.length === 0 ? <div className="card text-sm text-gray-400 text-center py-8">No {tab === 'all' ? '' : tab} requests.</div> : (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Asked for</th>
                  <th className="px-4 py-3">Current BV Leader</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.requests.map(r => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.student_name}</p>
                      <p className="text-xs text-gray-400">{[r.student_phone, r.student_email].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{describeRequest(r)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.current_leader || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{r.note || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button onClick={() => setReview({ request: r, status: 'approved', note: '' })} className="text-xs font-medium px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
                          <button onClick={() => setReview({ request: r, status: 'rejected', note: '' })} className="text-xs font-medium px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50">Reject</button>
                        </div>
                      ) : (
                        <div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_CHIP[r.status]}`}>{r.status}</span>
                          {r.reviewed_by_name && <p className="text-xs text-gray-400 mt-1">by {r.reviewed_by_name} · {fmt(r.reviewed_at)}</p>}
                          {r.admin_note && <p className="text-xs text-gray-600 mt-0.5">{r.admin_note}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {review && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h2 className="font-bold text-gray-900 mb-1">{review.status === 'approved' ? 'Approve request' : 'Reject request'}</h2>
            <p className="text-sm text-gray-600">{review.request.student_name}: {describeRequest(review.request)}</p>
            {review.status === 'approved' && (
              <p className="text-xs text-gray-400 mt-1">
                {review.request.kind === 'bv_leader'
                  ? 'The student goes under this BV Leader in all of their current-semester courses.'
                  : 'The student is moved to the new course; their BV Leader moves with them. Past attendance stays on the old course.'}
              </p>
            )}
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">Note to the student <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input w-full" rows={2} maxLength={500} value={review.note} onChange={e => setReview(r => ({ ...r, note: e.target.value }))} />
            {review.error && <p className="text-sm text-red-600 mt-2">{review.error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={submitReview} disabled={saving} className={`flex-1 ${review.status === 'approved' ? 'btn-primary' : 'btn-danger'}`}>
                {saving ? 'Saving…' : review.status === 'approved' ? 'Approve' : 'Reject'}
              </button>
              <button onClick={() => setReview(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
