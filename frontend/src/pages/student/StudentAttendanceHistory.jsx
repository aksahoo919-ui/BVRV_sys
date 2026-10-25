import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import AttendanceTimeline from '../../components/AttendanceTimeline';

// The student's own attendance: % per course and BV Leader class, a graph of
// how it moved over time, and every class date (attended or missed).
export default function StudentAttendanceHistory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    api.get('/student/attendance/history')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load your attendance'));
  }, []);

  const pastCount = (data?.classes || []).filter(c => !c.is_current || c.enrolled === false).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your attendance % and every class date. Tap a point on the graph to see that day.</p>
        </div>
        {pastCount > 0 && (
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button onClick={() => setShowPast(false)} className={`px-3 py-1.5 ${!showPast ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Current semester</button>
            <button onClick={() => setShowPast(true)} className={`px-3 py-1.5 ${showPast ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>All semesters</button>
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
      {!data && !error ? <p className="text-sm text-gray-500">Loading…</p> : data && <AttendanceTimeline data={data} showPast={showPast} />}
    </div>
  );
}
