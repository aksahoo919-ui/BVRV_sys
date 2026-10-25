import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

// The current page's label from the role's sidebar list (longest matching path).
function pageLabel(nav, pathname) {
  let best = null;
  for (const item of nav || []) {
    if (!item.to) continue;
    if ((pathname === item.to || pathname.startsWith(item.to + '/')) && (!best || item.to.length > best.to.length)) best = item;
  }
  return best?.label || null;
}

export default function TopNav({ title, portal, nav, leading }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const page = pageLabel(nav, pathname);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  // Fetch notifications (student only for now; extend later for other roles)
  const fetchNotifications = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const r = await api.get('/student/notifications');
      const data = r.data || [];
      setNotifications(data);
      setUnread(data.filter(n => !n.is_read).length);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false);
    }
    if (panelOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    await Promise.all(unreadIds.map(id => api.patch(`/student/notifications/${id}/read`).catch(() => {})));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="bg-white border-b border-ivory-300 relative z-20">
      <div className="toran" aria-hidden="true" />
      <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {leading}
        {portal ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 text-sm">
            <span className="text-gray-500 whitespace-nowrap">{portal}</span>
            {page && (<>
              <svg className="w-3.5 h-3.5 text-gold-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-temple-800 truncate">{page}</span>
            </>)}
          </nav>
        ) : (
          <p className="font-semibold text-temple-800 text-sm sm:text-base truncate">{title}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => { setPanelOpen(v => !v); if (!panelOpen) fetchNotifications(); }}
            className="relative p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-700 transition-colors"
            title="Notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Slide-out panel */}
          {panelOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-800 text-sm">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline inline-flex items-center min-h-[24px]">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-8">No notifications</p>
                ) : notifications.slice(0, 20).map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 ${n.is_read ? 'bg-white' : 'bg-primary-50'}`}
                  >
                    <p className={`text-sm font-medium ${n.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{n.sender_name}</span>
                      <span className="text-xs text-gray-500">{timeAgo(n.sent_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-gray-800">{user?.name}</span>
          <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
        </div>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full ring-2 ring-primary-100" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        )}
        <button onClick={handleLogout} className="p-2 -m-1 text-gray-500 hover:text-red-500 transition-colors ml-1" title="Sign out" aria-label="Sign out">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
      </div>
    </header>
  );
}
