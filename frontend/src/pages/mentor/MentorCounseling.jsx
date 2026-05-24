import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';

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

const emptyForm = { student_id: '', meeting_date: '', note: '' };

export default function MentorCounseling() {
  const [notes, setNotes] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterStudentId, setFilterStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchNotes = useCallback(async (studentId) => {
    setLoading(true);
    setError('');
    try {
      const params = studentId ? { student_id: studentId } : {};
      const res = await api.get('/mentor/counseling-notes', { params });
      setNotes(res.data);
    } catch {
      setError('Failed to load counseling notes.');
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
      await fetchNotes('');
    }
    init();
  }, [fetchNotes]);

  function handleFilterChange(e) {
    const val = e.target.value;
    setFilterStudentId(val);
    fetchNotes(val);
  }

  function openAdd() {
    setEditingNote(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(note) {
    setEditingNote(note);
    setForm({
      student_id: String(note.student_id),
      meeting_date: note.meeting_date ? note.meeting_date.slice(0, 10) : '',
      note: note.note,
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingNote(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.student_id || !form.meeting_date || !form.note.trim()) {
      setFormError('All fields are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingNote) {
        await api.patch(`/mentor/counseling-notes/${editingNote.id}`, form);
      } else {
        await api.post('/mentor/counseling-notes', form);
      }
      closeModal();
      fetchNotes(filterStudentId);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this counseling note?')) return;
    try {
      await api.delete(`/mentor/counseling-notes/${id}`);
      fetchNotes(filterStudentId);
    } catch {
      alert('Failed to delete note.');
    }
  }

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.meeting_date) - new Date(a.meeting_date)
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Counseling Notes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{notes.length} note(s)</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto">
          + Add Note
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Student</label>
        <select
          value={filterStudentId}
          onChange={handleFilterChange}
          className="input"
        >
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : sortedNotes.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No counseling notes found.</div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <div key={note.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{note.student_name}</span>
                    <span className="text-xs text-gray-400">
                      {note.meeting_date ? new Date(note.meeting_date).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{note.note}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(note)}
                    className="btn-secondary text-xs px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="btn-danger text-xs px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          title={editingNote ? 'Edit Counseling Note' : 'Add Counseling Note'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                value={form.student_id}
                onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
                className="input"
                disabled={!!editingNote}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
              <input
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                rows={4}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="input resize-none"
                placeholder="Write counseling note…"
              />
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : editingNote ? 'Save Changes' : 'Add Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
