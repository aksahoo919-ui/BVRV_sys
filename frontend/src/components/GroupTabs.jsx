import React from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { GROUPS } from '../pages/admin/adminNav';

// Tab bar for one admin area, rendered above whichever page of the area is open.
export default function GroupTabs({ group }) {
  const ctx = useOutletContext() || {};
  const g = GROUPS.find(x => x.key === group);
  const counts = { pending: ctx.pendingCount, requests: ctx.requestCount };
  return (
    <>
      {g.tabs.length > 1 && (
        <nav aria-label={`${g.label} pages`} className="mb-5 -mx-1 overflow-x-auto">
          <ul className="flex gap-1 border-b border-gray-200 min-w-max px-1">
            {g.tabs.map(t => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-[3px] -mb-px min-h-[40px] ${
                      isActive ? 'border-gold-400 text-temple-800 font-semibold' : 'border-transparent text-gray-600 hover:text-temple-800'
                    }`
                  }
                >
                  {t.label}
                  {t.badge && counts[t.badge] > 0 && (
                    <span className="bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{counts[t.badge]}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Outlet context={ctx} />
    </>
  );
}
