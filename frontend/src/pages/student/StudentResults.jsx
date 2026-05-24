import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function gpaColor(gpa) {
  if (gpa >= 8) return 'text-emerald-600';
  if (gpa >= 6) return 'text-amber-500';
  return 'text-red-500';
}

function gpaBadgeColor(gpa) {
  if (gpa >= 8) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (gpa >= 6) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

export default function StudentResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/student/results');
        setResults(res.data);
      } catch {
        setError('Failed to load results.');
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

  const sortedResults = [...results].sort((a, b) => a.semester_number - b.semester_number);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Results</h1>
        <p className="text-sm text-gray-400 mt-0.5">Published semester results</p>
      </div>

      {sortedResults.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 font-medium">No results published yet.</p>
          <p className="text-gray-300 text-sm mt-1">Check back after your semester exams.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedResults.map((r, i) => {
            const gpa = parseFloat(r.gpa);
            const cgpa = parseFloat(r.cgpa);
            return (
              <div key={i} className="card flex flex-col gap-2">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {r.year_label}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">
                      Semester {r.semester_number}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {r.rank != null && (
                      <span className="bg-amber-50 text-amber-600 text-xs font-semibold px-2 py-1 rounded-full border border-amber-200">
                        Rank: {r.rank}{r.total_students != null ? ` / ${r.total_students}` : ''}
                      </span>
                    )}
                    {!isNaN(gpa) && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${gpaBadgeColor(gpa)}`}>
                        GPA {gpa.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* GPA */}
                <div className="flex items-end gap-3 py-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">GPA</p>
                    <p className={`text-4xl font-bold leading-none ${gpaColor(gpa)}`}>
                      {isNaN(gpa) ? '—' : gpa.toFixed(1)}
                    </p>
                  </div>
                  <div className="border-l border-gray-100 pl-3">
                    <p className="text-xs text-gray-400 mb-0.5">CGPA</p>
                    <p className={`text-2xl font-semibold leading-none ${gpaColor(cgpa)}`}>
                      {isNaN(cgpa) ? '—' : cgpa.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* GPA scale indicator */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      gpa >= 8 ? 'bg-emerald-500' : gpa >= 6 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min((gpa / 10) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-300 text-right">out of 10.0</p>

                {/* Download Report Card */}
                {r.semester_id != null && (
                  <button
                    onClick={() =>
                      window.open(`/student/results/${r.semester_id}/report-card`, '_blank')
                    }
                    className="mt-1 flex items-center justify-center gap-1.5 w-full text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-md transition-colors border border-primary-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Report Card
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
