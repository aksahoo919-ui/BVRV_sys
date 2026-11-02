import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100  text-red-600',
};

export default function DateUnlockRequest({ role }) {
  const base = role === 'mentor' ? '/mentor' : '/teacher';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  // Form
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`${base}/date-unlocks`).then(r => setRequests(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [base]);

  async function submit(e) {
    e.preventDefault();
    if (!date || !reason.trim()) return;
    setSubmitting(true);
    setMsg('');
    try {
      const r = await api.post(`${base}/date-unlocks`, { date, reason: reason.trim() });
      setRequests(prev => [r.data, ...prev]);
      setDate('');
      setReason('');
      setMsg('Request submitted. Admin will review it shortly.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        onClick={() => setShow(s => !s)}
        className="flex items-center gap-2 text-sm font-semibold text-temple-700 hover:text-temple-900"
      >
        <svg className={`w-4 h-4 transition-transform ${show ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Date Unlock Requests
        {requests.filter(r => r.status === 'approved').length > 0 && (
          <span className="inline-flex items-center bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {requests.filter(r => r.status === 'approved').length} approved
          </span>
        )}
      </button>

      {show && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">
            Request to unlock a past date (older than 7 days) so you can mark or correct attendance.
            Admin will approve the request, after which the date will be editable for you.
          </p>

          {/* Request form */}
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date to unlock</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Reason</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Forgot to mark, late information"
                  className="input w-full" required />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={submitting}
                className="btn-primary text-sm px-4 py-2 disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Request Unlock'}
              </button>
              {msg && <p className="text-sm text-gray-600">{msg}</p>}
            </div>
          </form>

          {/* Past requests */}
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : requests.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Your requests</p>
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {requests.map(r => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-800 min-w-[90px]">
                      {new Date(r.unlock_date + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm text-gray-600 flex-1 truncate">{r.reason}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No requests yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
