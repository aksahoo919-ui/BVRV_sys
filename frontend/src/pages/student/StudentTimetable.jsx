import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Hours 08:00 through 17:00 (last slot ends at 18:00)
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

const PALETTE = [
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-orange-100 text-orange-800 border-orange-200',
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function subjectColor(code) {
  return PALETTE[hashCode(code || '') % PALETTE.length];
}

function timeToHour(timeStr) {
  // "HH:MM:SS" → fractional hour number
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function SlotCard({ slot, compact = false }) {
  const color = subjectColor(slot.subject_code);
  return (
    <div className={`rounded border px-2 py-1 mb-1 last:mb-0 ${color} ${compact ? 'text-xs' : 'text-xs'}`}>
      <p className="font-bold leading-tight truncate">{slot.subject_code}</p>
      <p className="truncate leading-tight">{slot.subject_name}</p>
      {!compact && (
        <>
          <p className="text-gray-500 leading-tight truncate">{slot.teacher_name}</p>
          <p className="text-gray-500 leading-tight">{slot.room}</p>
        </>
      )}
    </div>
  );
}

export default function StudentTimetable() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/student/timetable');
        setSlots(res.data);
      } catch {
        setError('Failed to load timetable.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  // Build lookup: grid[day][hour] = [slot, ...]
  const grid = {};
  for (let d = 0; d < 7; d++) {
    grid[d] = {};
    for (const h of HOURS) {
      grid[d][h] = [];
    }
  }
  for (const slot of slots) {
    const startHour = Math.floor(timeToHour(slot.start_time));
    const day = slot.day_of_week;
    if (day >= 0 && day <= 6 && grid[day][startHour] !== undefined) {
      grid[day][startHour].push(slot);
    }
  }

  // Group slots by day for mobile list
  const byDay = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];
  for (const slot of slots) {
    byDay[slot.day_of_week]?.push(slot);
  }
  for (let d = 0; d < 7; d++) {
    byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const hasSlots = slots.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Timetable</h1>
        <p className="text-sm text-gray-400 mt-0.5">Weekly class schedule</p>
      </div>

      {!hasSlots ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400 font-medium">No timetable slots found.</p>
          <p className="text-gray-300 text-sm mt-1">Your schedule will appear here once it's set up.</p>
        </div>
      ) : (
        <>
          {/* Desktop grid */}
          <div className="hidden md:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 px-2 py-3 bg-gray-50 border-b border-r border-gray-100 text-gray-500 font-semibold text-xs text-center">
                      Time
                    </th>
                    {DAYS.map((day, i) => (
                      <th
                        key={day}
                        className="px-2 py-3 bg-gray-50 border-b border-r border-gray-100 text-gray-700 font-semibold text-xs text-center last:border-r-0"
                      >
                        {DAY_SHORT[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-2 py-1 bg-gray-50 border-r border-gray-100 text-gray-400 text-center font-mono align-top whitespace-nowrap">
                        {String(hour).padStart(2, '0')}:00
                      </td>
                      {Array.from({ length: 7 }, (_, dayIdx) => (
                        <td
                          key={dayIdx}
                          className="px-1 py-1 border-r border-gray-50 last:border-r-0 align-top min-w-[100px]"
                        >
                          {grid[dayIdx][hour].map((slot, si) => (
                            <SlotCard key={si} slot={slot} compact={false} />
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile day-grouped list */}
          <div className="md:hidden space-y-4">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const daySlots = byDay[dayIdx];
              if (daySlots.length === 0) return null;
              return (
                <div key={dayIdx} className="card overflow-hidden p-0">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-700">{DAYS[dayIdx]}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {daySlots.map((slot, si) => {
                      const color = subjectColor(slot.subject_code);
                      return (
                        <div key={si} className="flex gap-3 px-4 py-3">
                          <div className="text-xs text-gray-400 font-mono whitespace-nowrap pt-0.5 w-20 flex-shrink-0">
                            {formatTime(slot.start_time)}
                            <br />
                            <span className="text-gray-300">{formatTime(slot.end_time)}</span>
                          </div>
                          <div className={`flex-1 rounded border px-3 py-2 ${color}`}>
                            <p className="font-bold text-xs leading-tight">{slot.subject_code}</p>
                            <p className="text-xs leading-tight">{slot.subject_name}</p>
                            <p className="text-xs text-gray-500 leading-tight mt-0.5">{slot.teacher_name}</p>
                            {slot.room && (
                              <p className="text-xs text-gray-500 leading-tight">Room: {slot.room}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
