import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_META = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600' },
};

function daysBetween(from, to) {
  if (!from || !to) return '—';
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

const emptyForm = { from_date: '', to_date: '', reason: '' };

export default function StudentLeave() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchRequests() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/student/leave-requests');
      setRequests(res.data);
    } catch {
      setError('Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.from_date || !form.to_date || !form.reason.trim()) {
      setSubmitError('All fields are required.');
      return;
    }
    if (new Date(form.to_date) < new Date(form.from_date)) {
      setSubmitError('End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');
    try {
      await api.post('/student/leave-requests', form);
      setForm(emptyForm);
      setSuccessMsg('Leave request submitted successfully.');
      fetchRequests();
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.from_date) - new Date(a.from_date)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-sm text-gray-400 mt-0.5">Apply for leave and track your requests</p>
      </div>

      {/* Apply card */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Apply for Leave</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={form.from_date}
                onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={form.to_date}
                onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          {form.from_date && form.to_date && new Date(form.to_date) >= new Date(form.from_date) && (
            <p className="text-xs text-gray-400">
              Duration: {daysBetween(form.from_date, form.to_date)} day(s)
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="input resize-none"
              placeholder="Reason for leave…"
            />
          </div>
          {submitError && (
            <p className="text-red-500 text-sm">{submitError}</p>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMsg}
            </div>
          )}
          <div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">My Leave Requests</h2>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" />
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : sortedRequests.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">No leave requests yet.</div>
        ) : (
          <div className="space-y-3">
            {sortedRequests.map((req, i) => {
              const meta = STATUS_META[req.status] || STATUS_META.pending;
              const days = daysBetween(req.from_date, req.to_date);
              return (
                <div key={req.id || i} className="card">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {req.from_date
                            ? new Date(req.from_date).toLocaleDateString()
                            : '—'}
                          {' '}–{' '}
                          {req.to_date
                            ? new Date(req.to_date).toLocaleDateString()
                            : '—'}
                        </span>
                        <span className="text-xs text-gray-400">{days} day(s)</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{req.reason}</p>
                      {req.reviewed_by_name && (
                        <p className="text-xs text-gray-400 mt-1">
                          Reviewed by: {req.reviewed_by_name}
                        </p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
