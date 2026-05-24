import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Avatar({ name }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold text-lg flex items-center justify-center flex-shrink-0 select-none">
      {initial}
    </div>
  );
}

export default function MentorAlerts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('most_alerts');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/mentor/alerts', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error();
      setAlerts(await res.json());
    } catch {
      setError('Failed to load alerts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...alerts].sort((a, b) => {
    if (sortBy === 'most_alerts') {
      return (b.alert_reasons?.length || 0) - (a.alert_reasons?.length || 0);
    }
    if (sortBy === 'lowest_attendance') {
      return (a.attendance_pct ?? 100) - (b.attendance_pct ?? 100);
    }
    if (sortBy === 'lowest_gpa') {
      return (a.latest_gpa ?? 10) - (b.latest_gpa ?? 10);
    }
    return 0;
  });

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Alerts</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-400 mt-0.5">{alerts.length} student(s) with active alerts</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            <option value="most_alerts">Most Alerts</option>
            <option value="lowest_attendance">Lowest Attendance</option>
            <option value="lowest_gpa">Lowest GPA</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={load} className="mt-3 text-sm text-emerald-600 hover:underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700">All students are on track</p>
          <p className="text-sm text-gray-400 mt-1">No alerts at this time.</p>
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((s) => (
            <div
              key={s.student_id}
              className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 sm:w-52 flex-shrink-0">
                <Avatar name={s.student_name} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{s.student_name}</p>
                  <p className="text-xs text-gray-500 truncate">{s.roll_number}</p>
                </div>
              </div>

              <div className="flex-1 flex flex-wrap gap-2">
                {(s.alert_reasons || []).map((reason, i) => (
                  <span
                    key={i}
                    className="inline-block bg-red-100 text-red-600 text-xs font-medium px-3 py-1 rounded-full"
                  >
                    {reason}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Attendance</p>
                  <p className={`text-sm font-semibold ${
                    (s.attendance_pct || 0) >= 75 ? 'text-green-600' :
                    (s.attendance_pct || 0) >= 60 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {s.attendance_pct != null ? `${Number(s.attendance_pct).toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">GPA</p>
                  <p className={`text-sm font-semibold ${
                    (s.latest_gpa || 0) >= 8 ? 'text-green-600' :
                    (s.latest_gpa || 0) >= 6 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {s.latest_gpa != null ? Number(s.latest_gpa).toFixed(1) : '—'}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/mentor/students/${s.student_id}`)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  View Student
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
