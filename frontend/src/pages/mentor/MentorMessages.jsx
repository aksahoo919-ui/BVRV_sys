import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MentorMessages() {
  const [students, setStudents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messagesError, setMessagesError] = useState('');

  const [selectedMessage, setSelectedMessage] = useState(null);

  const [recipientType, setRecipientType] = useState('assigned_students');
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const loadStudents = useCallback(async () => {
    try {
      const res = await api.get('/mentor/students');
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch {
      // non-critical
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    setMessagesError('');
    try {
      const res = await api.get('/mentor/messages');
      setMessages(Array.isArray(res.data) ? res.data : (res.data?.messages ?? []));
    } catch {
      setMessagesError('Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadMessages();
  }, [loadStudents, loadMessages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      const payload = {
        recipient_type: recipientType,
        subject: subject.trim(),
        body: body.trim(),
      };
      if (recipientType === 'student' && studentId) {
        payload.student_id = studentId;
      }
      await api.post('/mentor/messages', payload);
      setSubject('');
      setBody('');
      setStudentId('');
      setRecipientType('assigned_students');
      setSendSuccess('Message sent successfully.');
      await loadMessages();
    } catch {
      setSendError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function recipientLabel(msg) {
    if (msg.recipient_type === 'assigned_students') return 'All Assigned Students';
    return msg.student_name || 'Student';
  }

  const ComposePanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Compose Message</h2>
        {selectedMessage && (
          <button
            onClick={() => setSelectedMessage(null)}
            className="text-sm text-emerald-600 hover:underline"
          >
            Back to Compose
          </button>
        )}
      </div>
      <form onSubmit={handleSend} className="flex flex-col gap-4 flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <select
            value={recipientType === 'assigned_students' ? 'assigned_students' : studentId}
            onChange={(e) => {
              if (e.target.value === 'assigned_students') {
                setRecipientType('assigned_students');
                setStudentId('');
              } else {
                setRecipientType('student');
                setStudentId(e.target.value);
              }
            }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="assigned_students">All Assigned Students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.roll_number})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Message subject"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="flex-1 flex flex-col">
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={6}
            className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        {sendSuccess && <p className="text-xs text-green-600">{sendSuccess}</p>}

        <button
          type="submit"
          disabled={sending || !subject.trim() || !body.trim()}
          className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </div>
  );

  const PreviewPanel = selectedMessage ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Message Preview</h2>
        <button
          onClick={() => setSelectedMessage(null)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          New Message
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex-1 overflow-y-auto space-y-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Subject</p>
          <p className="font-semibold text-gray-900 mt-0.5">{selectedMessage.subject}</p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">To</p>
            <p className="text-sm text-gray-700 mt-0.5">{recipientLabel(selectedMessage)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Sent</p>
            <p className="text-sm text-gray-700 mt-0.5">{formatDate(selectedMessage.sent_at)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Message</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedMessage.body}</p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sent messages list */}
        <div className="lg:w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Sent Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-96 lg:max-h-[calc(100vh-16rem)]">
            {loadingMessages && (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
              </div>
            )}
            {!loadingMessages && messagesError && (
              <p className="text-xs text-red-500 p-4">{messagesError}</p>
            )}
            {!loadingMessages && !messagesError && messages.length === 0 && (
              <p className="text-xs text-gray-400 p-4 text-center">No messages sent yet.</p>
            )}
            {!loadingMessages && !messagesError && messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedMessage?.id === msg.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{msg.subject}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{recipientLabel(msg)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(msg.sent_at)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Compose / Preview panel */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-h-96 lg:min-h-[calc(100vh-16rem)]">
          {selectedMessage ? PreviewPanel : ComposePanel}
        </div>
      </div>
    </div>
  );
}
