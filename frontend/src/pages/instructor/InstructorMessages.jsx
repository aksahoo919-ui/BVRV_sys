import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function InstructorMessages() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ subject_id: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/instructor/subjects').then(r => {
      setSubjects(r.data);
      if (r.data.length > 0) setForm(f => ({ ...f, subject_id: r.data[0].id }));
    });
  }, []);

  async function handleSend() {
    if (!form.body.trim()) { setError('Message body required'); return; }
    if (!form.subject_id) { setError('Select a subject'); return; }
    setSending(true); setError(''); setSent(false);
    try {
      await api.post('/instructor/messages', { subject_id: form.subject_id, body: form.body });
      setSent(true);
      setForm(f => ({ ...f, body: '' }));
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Send Message</h1>
      <div className="card max-w-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Class</label>
          <select
            className="input"
            value={form.subject_id}
            onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
          >
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            rows={4}
            className="input"
            placeholder="Type your message here…"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={handleSend} disabled={sending} className="btn-primary">
            {sending ? 'Sending…' : 'Send to Class'}
          </button>
          {sent && <span className="text-green-600 text-sm font-medium">✓ Sent</span>}
        </div>
      </div>
    </div>
  );
}
