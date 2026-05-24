import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function pctColor(pct) {
  if (pct >= 60) return 'text-emerald-600';
  if (pct >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function gradeLabel(pct) {
  if (pct >= 90) return { label: 'S', color: 'bg-purple-100 text-purple-700' };
  if (pct >= 80) return { label: 'A', color: 'bg-green-100 text-green-700' };
  if (pct >= 70) return { label: 'B', color: 'bg-blue-100 text-blue-700' };
  if (pct >= 60) return { label: 'C', color: 'bg-yellow-100 text-yellow-700' };
  if (pct >= 50) return { label: 'D', color: 'bg-orange-100 text-orange-700' };
  return { label: 'F', color: 'bg-red-100 text-red-700' };
}

function AssessmentBadge({ type }) {
  const map = {
    internal:   'bg-blue-100 text-blue-700',
    external:   'bg-purple-100 text-purple-700',
    assignment: 'bg-yellow-100 text-yellow-700',
    practical:  'bg-teal-100 text-teal-700',
    quiz:       'bg-orange-100 text-orange-700',
  };
  const cls = map[type?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {type || 'Other'}
    </span>
  );
}

export default function StudentMarks() {
  const [marks, setMarks] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [marksRes, resultsRes] = await Promise.all([
          api.get('/student/marks'),
          api.get('/student/results').catch(() => ({ data: [] })),
        ]);
        setMarks(marksRes.data);
        setResults(resultsRes.data);
      } catch {
        setError('Failed to load marks.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group by semester
  const semesterMap = {};
  for (const m of marks) {
    const key = `${m.semester_number}||${m.year_label}`;
    if (!semesterMap[key]) {
      semesterMap[key] = {
        key,
        semester_id: m.semester_id,
        semester_number: m.semester_number,
        year_label: m.year_label,
        rows: [],
      };
    }
    semesterMap[key].rows.push(m);
  }
  const semesters = Object.values(semesterMap).sort(
    (a, b) => a.semester_number - b.semester_number
  );

  const displaySemesters = selectedSemester
    ? semesters.filter((s) => s.key === selectedSemester)
    : semesters;

  function getResultForSemester(semesterId) {
    if (!semesterId) return null;
    return results.find((r) => r.semester_id === semesterId) || null;
  }

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Marks</h1>
        <p className="text-sm text-gray-400 mt-0.5">Academic performance records</p>
      </div>

      {marks.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No marks available.</div>
      ) : (
        <>
          {/* Semester selector */}
          <div className="card mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="input"
            >
              <option value="">All Semesters</option>
              {semesters.map((s) => (
                <option key={s.key} value={s.key}>
                  Semester {s.semester_number} — {s.year_label}
                </option>
              ))}
            </select>
          </div>

          {displaySemesters.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">No marks available.</div>
          ) : (
            <div className="space-y-6">
              {displaySemesters.map((sem) => {
                const semResult = getResultForSemester(sem.semester_id);
                return (
                  <div key={sem.key} className="card overflow-hidden p-0">
                    {/* Semester header */}
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="font-semibold text-gray-800 text-sm">
                        Semester {sem.semester_number}
                        <span className="ml-2 text-gray-400 font-normal">{sem.year_label}</span>
                      </p>
                      {sem.semester_id && (
                        <button
                          onClick={() =>
                            window.open(`/student/marks-memo/${sem.semester_id}`, '_blank')
                          }
                          className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-md transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Marks Memo
                        </button>
                      )}
                    </div>

                    {/* Marks table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">%</th>
                            <th className="text-center px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sem.rows.map((row, i) => {
                            const pct = row.max_marks > 0
                              ? Math.round((row.scored_marks / row.max_marks) * 100)
                              : 0;
                            const grade = gradeLabel(pct);
                            return (
                              <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-2.5 text-gray-500 font-mono text-xs">{row.subject_code}</td>
                                <td className="px-4 py-2.5 text-gray-800">{row.subject_name}</td>
                                <td className="px-4 py-2.5">
                                  <AssessmentBadge type={row.assessment_type} />
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-700">
                                  {row.scored_marks} / {row.max_marks}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${pctColor(pct)}`}>
                                  {pct}%
                                </td>
                                <td className="px-6 py-2.5 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${grade.color}`}>
                                    {grade.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* GPA / CGPA summary */}
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">GPA this semester</span>
                        <span className="text-sm font-bold text-gray-800">
                          {semResult && semResult.gpa != null ? parseFloat(semResult.gpa).toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">CGPA</span>
                        <span className="text-sm font-bold text-gray-800">
                          {semResult && semResult.cgpa != null ? parseFloat(semResult.cgpa).toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
