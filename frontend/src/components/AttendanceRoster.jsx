import React, { useMemo, useState } from 'react';

// Roster with name/roll-number search and per-student status buttons.
// Used by teacher manual attendance and BV Leader class attendance.

const STYLES = {
  present: 'bg-emerald-600 text-white border-emerald-600',
  absent:  'bg-red-600 text-white border-red-600',
  service: 'bg-indigo-600 text-white border-indigo-600',
  late:    'bg-amber-500 text-white border-amber-500',
  flagged: 'bg-rose-500 text-white border-rose-500',
};
const LABELS = { present: 'Present', absent: 'Absent', service: 'Service', late: 'Late', flagged: 'Flagged' };

export default function AttendanceRoster({ roster, onStatus, onMarkAll, disabled = false, emptyText = 'No students.' }) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(s =>
      (s.name || '').toLowerCase().includes(q) || (s.roll_number || '').toLowerCase().includes(q));
  }, [roster, search]);

  const counts = roster.reduce((c, s) => ({ ...c, [s.status]: (c[s.status] || 0) + 1 }), {});

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <input
            type="search"
            className="input pl-8"
            placeholder="Search by name or roll no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        </div>
        {!disabled && onMarkAll && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onMarkAll('present', visible.map(s => s.id))} className="text-xs px-3 py-1 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              {search ? 'Shown present' : 'All present'}
            </button>
            <button type="button" onClick={() => onMarkAll('absent', visible.map(s => s.id))} className="text-xs px-3 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50">
              {search ? 'Shown absent' : 'All absent'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-2">
        {(counts.present || 0) + (counts.late || 0)} present · {counts.service || 0} service · {counts.absent || 0} absent
        {counts.flagged ? ` · ${counts.flagged} flagged` : ''} · {roster.length} total
        {search && ` — showing ${visible.length}`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.length === 0 && (
              <tr><td colSpan={3} className="text-center py-8 text-gray-400">{roster.length ? 'No students match your search.' : emptyText}</td></tr>
            )}
            {visible.map(s => {
              // Late/flagged come from PIN sessions; show them only when that is the current status.
              const options = ['present', 'absent', 'service', ...(['late', 'flagged'].includes(s.status) ? [s.status] : [])];
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{s.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      {options.map(st => (
                        <button
                          key={st}
                          type="button"
                          disabled={disabled}
                          onClick={() => onStatus(s.id, st)}
                          title={st === 'service' ? 'Came to class but was sent for service — counts as attended' : undefined}
                          className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors disabled:cursor-not-allowed ${
                            s.status === st ? STYLES[st] : 'border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                          }`}
                        >{LABELS[st]}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
