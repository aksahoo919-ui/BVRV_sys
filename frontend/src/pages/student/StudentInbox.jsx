import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function StudentInbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/student/messages').then(r => setMessages(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleExpand(msg) {
    if (expanded === msg.id) { setExpanded(null); return; }
    setExpanded(msg.id);
    if (!msg.is_read) {
      try {
        await api.patch(`/student/messages/${msg.id}/read`);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      } catch {}
    }
  }

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
        {unreadCount > 0 && <span className="badge bg-primary-600 text-white">{unreadCount} unread</span>}
      </div>

      {messages.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {messages.map(m => (
            <div
              key={m.id}
              className={`card cursor-pointer hover:shadow-md transition-shadow ${!m.is_read ? 'border-primary-200 bg-primary-50/30' : ''}`}
              onClick={() => handleExpand(m)}
            >
              <div className="flex items-start gap-3">
                <Avatar user={{ name: m.sender_name, avatar_url: m.sender_avatar }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{m.sender_name}</p>
                      {!m.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full inline-block" />}
                    </div>
                    <time className="text-xs text-gray-400 flex-shrink-0">{formatTime(m.sent_at)}</time>
                  </div>
                  {m.subject_name && (
                    <p className="text-xs text-gray-500">{m.subject_name}</p>
                  )}
                  {expanded === m.id ? (
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{m.body}</p>
                  ) : (
                    <p className="text-sm text-gray-500 truncate mt-0.5">{m.body}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function Avatar({ user }) {
  if (user?.avatar_url) return <img src={user.avatar_url} className="w-9 h-9 rounded-full flex-shrink-0" alt="" />;
  return <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">{user?.name?.[0]?.toUpperCase()}</div>;
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
