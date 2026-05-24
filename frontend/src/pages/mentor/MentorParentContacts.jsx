import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';

const MEDIUM_META = {
  call:    { label: 'Call',    emoji: '📞', color: 'bg-blue-100 text-blue-700' },
  email:   { label: 'Email',   emoji: '✉️',  color: 'bg-green-100 text-green-700' },
  meeting: { label: 'Meeting', emoji: '🤝', color: 'bg-purple-100 text-purple-700' },
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

const emptyForm = { student_id: '', contact_date: '', medium: 'call', summary: '' };

export default function MentorParentContacts() {
  const [contacts, setContacts] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterStudentId, setFilterStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchContacts = useCallback(async (studentId) => {
    setLoading(true);
    setError('');
    try {
      const params = studentId ? { student_id: studentId } : {};
      const res = await api.get('/mentor/parent-contacts', { params });
      setContacts(res.data);
    } catch {
      setError('Failed to load parent contacts.');
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
      await fetchContacts('');
    }
    init();
  }, [fetchContacts]);

  function handleFilterChange(e) {
    const val = e.target.value;
    setFilterStudentId(val);
    fetchContacts(val);
  }

  function openModal() {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.student_id || !form.contact_date || !form.summary.trim()) {
      setFormError('Student, date, and summary are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/mentor/parent-contacts', form);
      closeModal();
      fetchContacts(filterStudentId);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to log contact.');
    } finally {
      setSaving(false);
    }
  }

  const sortedContacts = [...contacts].sort(
    (a, b) => new Date(b.contact_date) - new Date(a.contact_date)
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Parent Contacts</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contacts.length} record(s)</p>
        </div>
        <button onClick={openModal} className="btn-primary self-start sm:self-auto">
          + Log Contact
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Student</label>
        <select value={filterStudentId} onChange={handleFilterChange} className="input">
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : sortedContacts.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No parent contacts logged yet.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 hidden sm:block" />
          <div className="space-y-4">
            {sortedContacts.map((c) => {
              const meta = MEDIUM_META[c.medium] || MEDIUM_META.call;
              return (
                <div key={c.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="hidden sm:flex flex-shrink-0 w-10 justify-center pt-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white z-10" />
                  </div>
                  <div className="card flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{c.student_name}</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}
                          >
                            <span>{meta.emoji}</span>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.contact_date ? new Date(c.contact_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{c.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal title="Log Parent Contact" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                value={form.student_id}
                onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
                className="input"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Date</label>
              <input
                type="date"
                value={form.contact_date}
                onChange={(e) => setForm((f) => ({ ...f, contact_date: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medium</label>
              <div className="flex gap-3">
                {Object.entries(MEDIUM_META).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, medium: key }))}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      form.medium === key
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{meta.emoji}</span>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea
                rows={3}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                className="input resize-none"
                placeholder="Brief summary of the contact…"
              />
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Log Contact'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
