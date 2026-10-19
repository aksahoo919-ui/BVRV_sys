import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

const fmt = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// A student's classes semester by semester (newest first): course, class,
// teachers, BV leader and attendance in that class. Used by All Users and BV Members.
export default function StudentTimelineModal({ student, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/admin/users/${student.id}/timeline`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load the timeline'));
  }, [student.id]);

  // one block per semester (classes without a semester go in their own block)
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of data?.timeline || []) {
      const key = r.semester_id || 'none';
      if (!m.has(key)) m.set(key, { key, label: r.semester_id ? r.semester_label : 'No semester', start: r.start_date, end: r.end_date, current: r.is_current && !!r.semester_id, rows: [] });
      m.get(key).rows.push(r);
    }
    return [...m.values()];
  }, [data]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Timeline: {student.name}</h2>
            {data?.user && (
              <p className="text-xs text-gray-400">
                {[data.user.phone, data.user.email].filter(Boolean).join(' · ')} · joined the portal {fmt(data.user.created_at)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        {!data && !error ? <p className="text-sm text-gray-400">Loading…</p> : data && (
          groups.length === 0 ? <p className="text-sm text-gray-400">Not in any class yet.</p> : (
            <ol className="relative border-l-2 border-gray-100 ml-2 space-y-5">
              {groups.map(g => (
                <li key={g.key} className="relative pl-4">
                  <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ${g.current ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{g.label}</p>
                    {g.current && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>}
                    {g.start && <span className="text-xs text-gray-400">{fmt(g.start)} – {fmt(g.end)}</span>}
                  </div>
                  <div className="mt-2 space-y-2">
                    {g.rows.map(r => (
                      <div key={r.subject_id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{r.course_name ? `${r.course_name} · ` : ''}{r.code}</p>
                            <p className="text-xs text-gray-400">{r.class_name}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${r.percentage == null ? 'text-gray-400' : r.percentage < 75 ? 'text-amber-600' : 'text-green-600'}`}>
                              {r.percentage == null ? 'No classes yet' : `${r.percentage}%`}
                            </p>
                            <p className="text-xs text-gray-400">{r.days_present} of {r.class_days} class day{r.class_days === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-2 text-xs text-gray-600">
                          <p><span className="text-gray-400">Teacher:</span> {r.teachers || '—'}</p>
                          <p><span className="text-gray-400">BV Leader:</span> {r.bv_leader || '—'}</p>
                          <p><span className="text-gray-400">Classes held:</span> {r.first_class ? `${fmt(r.first_class)} – ${fmt(r.last_class)}` : '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )
        )}
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </div>
    </div>
  );
}
