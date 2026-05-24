import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import TopNav from '../../components/TopNav';
import api from '../../utils/api';

const NAV = [
  { to: '/admin/home', label: 'Dashboard', icon: '🏠' },
  { section: 'Users' },
  { to: '/admin/pending', label: 'Approvals', icon: '⏳' },
  { to: '/admin/users', label: 'All Users', icon: '👥' },
  { section: 'Academic' },
  { to: '/admin/courses', label: 'Courses', icon: '📚' },
  { to: '/admin/academic-years', label: 'Academic Years', icon: '📅' },
{ section: 'Classes' },
  { to: '/admin/subjects', label: 'Subjects', icon: '📖' },
  { to: '/admin/classes', label: 'Class Management', icon: '🏫' },
  { to: '/admin/timetable', label: 'Timetable', icon: '🕐' },
  { to: '/admin/mentor-assignments', label: 'Mentor Assignments', icon: '🤝' },
  { to: '/admin/enrollments', label: 'Enrollments', icon: '📝' },
  { section: 'Operations' },
  { to: '/admin/corrections', label: 'Attend. Corrections', icon: '✏️' },
  { to: '/admin/leave', label: 'Leave Requests', icon: '📋' },
  { to: '/admin/results', label: 'Results', icon: '🏆' },
  { section: 'Reports & Comms' },
  { to: '/admin/reports', label: 'Reports', icon: '📊' },
  { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
  { section: 'System' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin/audit', label: 'Audit Logs', icon: '📜' },
  { to: '/admin/backups', label: 'Backups', icon: '💾' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    api.get('/admin/pending-users').then(r => setPendingCount(r.data.length)).catch(() => {});
  }, []);

  const refreshPending = () =>
    api.get('/admin/pending-users').then(r => setPendingCount(r.data.length)).catch(() => {});

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 bg-slate-800 text-white flex flex-col transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-4 py-4 border-b border-slate-700 flex-shrink-0">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Admin Panel</p>
          <p className="font-bold text-white mt-0.5 text-sm">BVRV Attendance</p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map((item, i) =>
            item.section ? (
              <p key={i} className="px-4 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                {item.section}
              </p>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
                    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                  }`
                }
              >
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.to === '/admin/pending' && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingCount}</span>
                )}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center bg-white border-b border-gray-200 px-3 py-2">
          <button onClick={() => setSidebarOpen(true)} className="mr-3 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-800 text-sm">Admin Dashboard</span>
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
