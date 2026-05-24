import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';

const STATUS_TABS = ['all', 'pending', 'completed', 'cancelled'];

const STATUS_META = {
  pending:   { label: 'Pending',   color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

const emptyScheduleForm = { student_id: '', scheduled_at: '', agenda: '' };

export default function MentorMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterStudentId, setFilterStudentId] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Schedule modal
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Status update modal
  const [statusModal, setStatusModal] = useState(null); // { meeting, targetStatus }
  const [statusNotes, setStatusNotes] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');

  const fetchMeetings = useCallback(async (studentId, status) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (studentId) params.student_id = studentId;
      if (status && status !== 'all') params.status = status;
      const res = await api.get('/mentor/meetings', { params });
      setMeetings(res.data);
    } catch {
      setError('Failed to load meetings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await api.get('/mentor/students');
        setStudents(res.data);
      } catch {
        // silently ignore
      }
      await fetchMeetings('', 'all');
    }
    init();
  }, [fetchMeetings]);

  function handleFilterChange(e) {
    const val = e.target.value;
    setFilterStudentId(val);
    fetchMeetings(val, activeTab);
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    fetchMeetings(filterStudentId, tab);
  }

  // Schedule modal
  function openSchedule() {
    setScheduleForm(emptyScheduleForm);
    setScheduleError('');
    setScheduleOpen(true);
  }

  function closeSchedule() {
    setScheduleOpen(false);
    setScheduleForm(emptyScheduleForm);
    setScheduleError('');
  }

  async function handleScheduleSubmit(e) {
    e.preventDefault();
    if (!scheduleForm.student_id || !scheduleForm.scheduled_at) {
      setScheduleError('Student and date/time are required.');
      return;
    }
    setScheduleSaving(true);
    setScheduleError('');
    try {
      await api.post('/mentor/meetings', scheduleForm);
      closeSchedule();
      fetchMeetings(filterStudentId, activeTab);
    } catch (err) {
      setScheduleError(err?.response?.data?.message || 'Failed to schedule meeting.');
    } finally {
      setScheduleSaving(false);
    }
  }

  // Status modal
  function openStatusModal(meeting, targetStatus) {
    setStatusModal({ meeting, targetStatus });
    setStatusNotes('');
    setStatusError('');
  }

  function closeStatusModal() {
    setStatusModal(null);
    setStatusNotes('');
    setStatusError('');
  }

  async function handleStatusUpdate(e) {
    e.preventDefault();
    if (!statusModal) return;
    setStatusSaving(true);
    setStatusError('');
    try {
      const payload = { status: statusModal.targetStatus };
      if (statusModal.targetStatus === 'completed' && statusNotes.trim()) {
        payload.notes = statusNotes.trim();
      }
      await api.patch(`/mentor/meetings/${statusModal.meeting.id}`, payload);
      closeStatusModal();
      fetchMeetings(filterStudentId, activeTab);
    } catch (err) {
      setStatusError(err?.response?.data?.message || 'Failed to update meeting.');
    } finally {
      setStatusSaving(false);
    }
  }

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
  );

  function formatDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · '
      + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-400 mt-0.5">{meetings.length} meeting(s)</p>
        </div>
        <button onClick={openSchedule} className="btn-primary self-start sm:self-auto">
          + Schedule Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Student</label>
          <select value={filterStudentId} onChange={handleFilterChange} className="input">
            <option value="">All Students</option>
            {students.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Meetings list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : sortedMeetings.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No meetings found.</div>
      ) : (
        <div className="space-y-3">
          {sortedMeetings.map((m) => {
            const meta = STATUS_META[m.status] || STATUS_META.pending;
            return (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{m.student_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">📅 {formatDateTime(m.scheduled_at)}</p>
                    {m.agenda && (
                      <p className="text-sm text-gray-700 mt-1">{m.agenda}</p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">Notes: {m.notes}</p>
                    )}
                  </div>
                  {m.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openStatusModal(m, 'completed')}
                        className="btn-primary text-xs px-2 py-1"
                      >
                        Mark Complete
                      </button>
                      <button
                        onClick={() => openStatusModal(m, 'cancelled')}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleOpen && (
        <Modal title="Schedule Meeting" onClose={closeSchedule}>
          <form onSubmit={handleScheduleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                value={scheduleForm.student_id}
                onChange={(e) => setScheduleForm((f) => ({ ...f, student_id: e.target.value }))}
                className="input"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; Time</label>
              <input
                type="datetime-local"
                value={scheduleForm.scheduled_at}
                onChange={(e) => setScheduleForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agenda</label>
              <textarea
                rows={3}
                value={scheduleForm.agenda}
                onChange={(e) => setScheduleForm((f) => ({ ...f, agenda: e.target.value }))}
                className="input resize-none"
                placeholder="Meeting agenda…"
              />
            </div>
            {scheduleError && <p className="text-red-500 text-sm">{scheduleError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeSchedule} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={scheduleSaving} className="btn-primary">
                {scheduleSaving ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <Modal
          title={statusModal.targetStatus === 'completed' ? 'Mark as Completed' : 'Cancel Meeting'}
          onClose={closeStatusModal}
        >
          <form onSubmit={handleStatusUpdate} className="space-y-4">
            <p className="text-sm text-gray-600">
              {statusModal.targetStatus === 'completed'
                ? `Mark the meeting with ${statusModal.meeting.student_name} as completed?`
                : `Cancel the meeting with ${statusModal.meeting.student_name}?`}
            </p>
            {statusModal.targetStatus === 'completed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="input resize-none"
                  placeholder="Meeting outcome notes…"
                />
              </div>
            )}
            {statusError && <p className="text-red-500 text-sm">{statusError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeStatusModal} className="btn-secondary">
                Back
              </button>
              <button
                type="submit"
                disabled={statusSaving}
                className={statusModal.targetStatus === 'completed' ? 'btn-primary' : 'btn-danger'}
              >
                {statusSaving
                  ? 'Updating…'
                  : statusModal.targetStatus === 'completed'
                  ? 'Mark Complete'
                  : 'Cancel Meeting'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
