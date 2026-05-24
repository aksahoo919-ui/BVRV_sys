import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TeacherMessages() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ subject_id: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  useEffect(() => {
    api.get('/teacher/subjects')
      .then(r => {
        setSubjects(r.data);
        if (r.data.length > 0) {
          setForm(f => ({ ...f, subject_id: String(r.data[0].id) }));
        }
      })
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoadingSubjects(false));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setSent(false);
    setError('');
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.subject_id) {
      setError('Please select a subject.');
      return;
    }
    if (!form.body.trim()) {
      setError('Message body cannot be empty.');
      return;
    }
    setSending(true);
    setError('');
    setSent(false);
    try {
      await api.post('/teacher/messages', {
        subject_id: form.subject_id,
        body: form.body.trim(),
      });
      setSent(true);
      setForm(f => ({ ...f, body: '' }));
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Send Message to Class</h1>

      <div className="card max-w-lg">
        <p className="text-sm text-gray-500 mb-5">
          Send a broadcast message to all enrolled students in the selected subject.
        </p>

        <form onSubmit={handleSend} noValidate>
          {/* Subject selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject / Class
            </label>
            {loadingSubjects ? (
              <div className="input flex items-center gap-2 text-gray-400 text-sm">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Loading subjects…
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No subjects assigned. Contact your administrator.
              </p>
            ) : (
              <select
                name="subject_id"
                className="input"
                value={form.subject_id}
                onChange={handleChange}
              >
                {subjects.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Message body */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              name="body"
              rows={5}
              className="input resize-y"
              placeholder="Type your message here…"
              value={form.body}
              onChange={handleChange}
              maxLength={2000}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {form.body.length} / 2000
            </p>
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={sending || loadingSubjects || subjects.length === 0}
              className="btn-primary disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send to Class'}
            </button>
            {sent && (
              <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                ✓ Sent
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
