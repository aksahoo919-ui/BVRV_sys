import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const AUDIENCES = [
  { value: 'everyone',          label: 'Everyone' },
  { value: 'all_students',      label: 'All Students' },
  { value: 'all_teachers',      label: 'All Teachers' },
  { value: 'all_mentors',       label: 'All Mentors' },
  { value: 'class_students',    label: 'Students in a Class' },
  { value: 'assigned_students', label: 'Assigned Students' },
];

const SUBJECT_AUDIENCES = new Set(['class_students', 'assigned_students']);

const AUDIENCE_BADGE = {
  everyone:          'bg-purple-100 text-purple-700',
  all_students:      'bg-blue-100 text-blue-700',
  all_teachers:      'bg-indigo-100 text-indigo-700',
  all_mentors:       'bg-teal-100 text-teal-700',
  class_students:    'bg-green-100 text-green-700',
  assigned_students: 'bg-orange-100 text-orange-700',
};

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const EMPTY_FORM = { title: '', body: '', audience: 'everyone', subject_id: '' };

export default function AdminNotifications() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // Load subjects for the subject selector
  useEffect(() => {
    api.get('/admin/subjects')
      .then(r => setSubjects(r.data))
      .catch(() => {});
  }, []);

  async function loadNotifications() {
    setListLoading(true);
    setListError('');
    try {
      const r = await api.get('/admin/notifications');
      setNotifications(r.data);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to load notifications.');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { loadNotifications(); }, []);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSend() {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.body.trim()) { setFormError('Body is required.'); return; }
    if (SUBJECT_AUDIENCES.has(form.audience) && !form.subject_id) {
      setFormError('Please select a subject for this audience type.');
      return;
    }

    setSending(true);
    setFormError('');
    setSent(false);

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
    };
    if (SUBJECT_AUDIENCES.has(form.audience) && form.subject_id) {
      payload.subject_id = form.subject_id;
    }

    try {
      await api.post('/admin/notifications', payload);
      setSent(true);
      setForm(EMPTY_FORM);
      setTimeout(() => setSent(false), 4000);
      await loadNotifications();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>

      {/* Send form */}
      <div className="card max-w-xl">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Send Notification</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            className="input"
            placeholder="Notification title…"
            value={form.title}
            onChange={e => setField('title', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            rows={4}
            className="input"
            placeholder="Write your message here…"
            value={form.body}
            onChange={e => setField('body', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
          <select
            className="input"
            value={form.audience}
            onChange={e => setField('audience', e.target.value)}
          >
            {AUDIENCES.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {SUBJECT_AUDIENCES.has(form.audience) && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="input"
              value={form.subject_id}
              onChange={e => setField('subject_id', e.target.value)}
            >
              <option value="">— Select a subject —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
        )}

        {formError && (
          <p className="text-red-600 text-sm mb-3">{formError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary"
          >
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
          {sent && (
            <span className="text-green-600 text-sm font-medium">✓ Sent</span>
          )}
        </div>
      </div>

      {/* Sent history */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sent History</h2>

        {listError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{listError}</div>
        )}

        {listLoading ? (
          <Spinner />
        ) : notifications.length === 0 ? (
          <div className="card text-center text-gray-400 py-12">
            No notifications sent yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n, i) => (
              <div key={n.id || i} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 mb-1">{n.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{n.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`badge text-xs capitalize ${AUDIENCE_BADGE[n.audience] || 'bg-gray-100 text-gray-600'}`}>
                      {(AUDIENCES.find(a => a.value === n.audience) || {}).label || n.audience}
                    </span>
                    {n.subject_name && (
                      <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                        {n.subject_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                  <span>{formatDateTime(n.sent_at || n.created_at)}</span>
                  {n.sender_name && (
                    <>
                      <span>·</span>
                      <span>by {n.sender_name}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
