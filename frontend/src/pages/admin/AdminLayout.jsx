import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import TopNav from '../../components/TopNav';
import MobileLogout from '../../components/MobileLogout';
import api from '../../utils/api';
import { TempleLockup } from '../../components/TempleMark';

const NAV = [
  { to: '/admin/home', label: 'Dashboard', icon: '🏠' },
  { section: 'Users' },
  { to: '/admin/pending', label: 'Approvals', icon: '⏳' },
  { to: '/admin/users', label: 'All Users', icon: '👥' },
  { to: '/admin/profile-requests', label: 'Profile Requests', icon: '📨' },
  { section: 'Mentors' },
  { to: '/admin/mentors/bvrv', label: 'BVRV Mentors', icon: '🧑‍🏫' },
  { to: '/admin/mentors/bv', label: 'BV Mentors', icon: '🙏' },
  { section: 'Academic' },
  { to: '/admin/courses', label: 'Courses', icon: '📚' },
  { to: '/admin/academic-years', label: 'Academic Years', icon: '📅' },
  { to: '/admin/semesters', label: 'Semesters', icon: '🗓️' },
{ section: 'Classes' },
  { to: '/admin/subjects', label: 'Subjects', icon: '📖' },
  { to: '/admin/classes', label: 'Class Management', icon: '🏫' },
  { to: '/admin/timetable', label: 'Timetable', icon: '🕐' },
  { to: '/admin/class-mentors', label: 'Class BV Leaders', icon: '🧑‍🏫' },
  { to: '/admin/bv-members', label: 'BV Members', icon: '🫂' },
  { to: '/admin/enrollments', label: 'Enrollments', icon: '📝' },
  { section: 'Operations' },
  { to: '/admin/corrections', label: 'Attend. Corrections', icon: '✏️' },
  { to: '/admin/results', label: 'Results', icon: '🏆' },
  { section: 'Reports' },
  { to: '/admin/attendance', label: 'Attendance %', icon: '📈' },
  { to: '/admin/reports', label: 'Reports', icon: '📊' },
  { section: 'System' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin/audit', label: 'Audit Logs', icon: '📜' },
  { to: '/admin/backups', label: 'Backups', icon: '💾' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);

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
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map((item, i) =>
            item.section ? (
              <p key={i} className="px-4 pt-3 pb-1 text-xs text-gold-300/90 uppercase tracking-wider font-semibold">
                {item.section}
              </p>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-1.5 text-sm transition-colors border-l-[3px] ${
                    isActive
                      ? 'bg-temple-700 text-white border-gold-400 font-medium'
                      : 'text-temple-100 hover:bg-temple-700/60 border-transparent'
                  }`
                }
              >
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.to === '/admin/pending' && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingCount}</span>
                )}
                {item.to === '/admin/profile-requests' && requestCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{requestCount}</span>
                )}
              </NavLink>
            )
          )}
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
          <TopNav title="Admin Dashboard" />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet context={{ refreshPending }} />
        </main>
      </div>
    </div>
  );
}
