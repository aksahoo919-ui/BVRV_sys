import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
function timeLabel(h) { return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`; }
function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

export default function TeacherTimetable() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/timetable')
      .then(r => setSlots(r.data))
      .catch(() => setError('Failed to load timetable'))
      .finally(() => setLoading(false));
  }, []);

  const grid = {};
  for (const slot of slots) {
    const d = slot.day_of_week;
    const h = parseInt(slot.start_time?.split(':')[0] || '8');
    if (!grid[d]) grid[d] = {};
    if (!grid[d][h]) grid[d][h] = [];
    grid[d][h].push(slot);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Timetable</h1>
        <p className="text-sm text-gray-400 mt-0.5">{slots.length} class slot{slots.length!==1?'s':''} scheduled</p>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {slots.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No timetable slots assigned yet.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="py-2 px-3 text-left w-14 font-medium text-slate-300">Time</th>
                {DAYS.map((d,i) => <th key={i} className="py-2 px-2 text-center font-medium">{d.slice(0,3)}</th>)}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(h => (
                <tr key={h} className="border-t border-gray-100">
                  <td className="py-1.5 px-3 text-gray-400 font-mono align-top">{timeLabel(h)}</td>
                  {DAYS.map((_, d) => {
                    const cellSlots = grid[d]?.[h] || [];
                    return (
                      <td key={d} className="py-1 px-1 align-top border-l border-gray-50">
                        {cellSlots.map(s => (
                          <div key={s.id} className="bg-primary-50 border border-primary-200 rounded px-1.5 py-1 mb-1">
                            <p className="font-semibold text-primary-700 truncate">{s.subject_code}</p>
                            <p className="text-gray-500 truncate">{s.subject_name}</p>
                            <p className="text-gray-400">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</p>
                            {s.room && <p className="text-gray-400">📍 {s.room}</p>}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
