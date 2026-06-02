import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function AttendanceBar({ pct }) {
  const value = Math.min(Math.max(pct || 0, 0), 100);
  const color =
    value >= 75 ? 'bg-green-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-500';
  const textColor =
    value >= 75 ? 'text-green-700' : value >= 60 ? 'text-amber-700' : 'text-red-600';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">Attendance</span>
        <span className={`text-xs font-semibold ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function GpaBadge({ gpa }) {
  if (gpa == null) return null;
  const bg =
    gpa >= 8 ? 'bg-green-100 text-green-700' : gpa >= 6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${bg}`}>
      GPA: {Number(gpa).toFixed(1)} / 10
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded w-full mb-2" />
      <div className="h-5 bg-gray-200 rounded w-1/3 mt-3" />
      <div className="h-9 bg-gray-200 rounded w-full mt-4" />
    </div>
  );
}

function StudentCard({ student }) {
  const navigate = useNavigate();
  const initial = student.name ? student.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={student.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xl flex items-center justify-center select-none">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{student.name}</p>
          <p className="text-xs text-gray-500 truncate">{student.roll_number}</p>
          <p className="text-xs text-gray-400 truncate">{student.email}</p>
        </div>
        {student.alert_reasons && student.alert_reasons.length > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
            ⚠ Alerts
          </span>
        )}
      </div>

      <AttendanceBar pct={student.attendance_percentage} />

      <GpaBadge gpa={student.latest_gpa} />

      <button
        onClick={() => navigate(`/mentor/students/${student.id}`)}
        className="mt-auto w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
      >
        View Details
      </button>
    </div>
  );
}

export default function MentorStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/mentor/students');
        setStudents(Array.isArray(res.data) ? res.data : []);
      } catch {
        setError('Failed to load students. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Students</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-400 mt-0.5">{students.length} student(s) assigned</p>
          )}
        </div>
        <input
          type="text"
          placeholder="Search by name or roll number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No students assigned</p>
          {search && (
            <p className="text-sm mt-1">No results for "{search}"</p>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <StudentCard key={s.id} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}
