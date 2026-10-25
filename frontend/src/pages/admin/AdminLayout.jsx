import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import TopNav from '../../components/TopNav';
import MobileLogout from '../../components/MobileLogout';
import api from '../../utils/api';
import { TempleLockup } from '../../components/TempleMark';
import Icon from '../../components/Icon';
import { GROUPS, PAGES, groupOf } from './adminNav';


export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const { pathname } = useLocation();
  const activeGroup = groupOf(pathname);

  useEffect(() => {
    api.get('/admin/pending-users').then(r => setPendingCount(r.data.length)).catch(() => {});
    Promise.all([
      api.get('/admin/profile-requests', { params: { status: 'pending' } }),
      api.get('/admin/member-requests', { params: { status: 'pending' } }),
    ]).then(([p, m]) => setRequestCount((p.data.counts?.pending || 0) + (m.data.counts?.pending || 0))).catch(() => {});
  }, []);

  const refreshPending = () =>
    api.get('/admin/pending-users').then(r => setPendingCount(r.data.length)).catch(() => {});

  return (
    <div className="flex h-screen bg-ivory-100">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 bg-temple-800 text-white flex flex-col transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-3 py-3 border-b border-temple-700 flex-shrink-0">
          <TempleLockup ground="dark" subtitle="Admin Panel" compact />
        </div>
        <div className="toran flex-shrink-0" aria-hidden="true" />
        <nav className="nav-scroll flex-1 py-2 overflow-y-auto">
          {GROUPS.map(g => {
            const active = activeGroup?.key === g.key;
            const badge = g.key === 'people' ? pendingCount + requestCount : 0;
            return (
              <Link
                key={g.key}
                to={g.tabs[0].to}
                onClick={() => setSidebarOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-l-[3px] ${
                    active
                      ? 'bg-temple-700 text-white border-gold-400 font-medium'
                      : 'text-temple-100 hover:bg-temple-700/60 border-transparent'
                  }`
                }
              >
                <Icon name={g.icon} className="w-[18px] h-[18px] flex-shrink-0 opacity-90" />
                <span className="flex-1 truncate">{g.label}</span>
                {badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden bg-temple-800">
          <div className="flex items-center px-3 py-2">
          <button onClick={() => setSidebarOpen(true)} className="mr-3 p-1 -m-1 text-gold-300" aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="font-semibold text-ivory-100 text-sm">Admin Dashboard</p>
            <MobileLogout />
          </div>
          <div className="toran" aria-hidden="true" />
        </div>
        <div className="hidden lg:block">
          <TopNav portal="Admin" nav={PAGES} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet context={{ refreshPending, pendingCount, requestCount }} />
        </main>
      </div>
    </div>
  );
}
