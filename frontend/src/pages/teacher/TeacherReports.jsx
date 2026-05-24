import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TeacherReports() {
  const [subjects, setSubjects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/subjects')
      .then(r => setSubjects(r.data))
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoadingSubjects(false));
  }, []);

  async function loadReport(subjectId) {
    if (!subjectId) {
      setReport([]);
      return;
    }
    setLoadingReport(true);
    setError('');
    try {
      const r = await api.get(`/teacher/reports/${subjectId}`);
      setReport(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report.');
      setReport([]);
    } finally {
      setLoadingReport(false);
    }
  }

  function handleSubjectChange(e) {
    const id = e.target.value;
    setSelectedId(id);
    loadReport(id);
  }

  const belowCount = report.filter(r => r.below_threshold).length;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Attendance Reports</h1>

      {/* Subject selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
        {loadingSubjects ? (
          <Spinner />
        ) : (
          <select
            className="input max-w-sm"
            value={selectedId}
            onChange={handleSubjectChange}
          >
            <option value="">— Choose a subject —</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loadingReport && <Spinner />}

      {!loadingReport && selectedId && report.length === 0 && !error && (
        <div className="card text-center py-10 text-gray-400">
          No attendance data found for this subject.
        </div>
      )}

      {!loadingReport && report.length > 0 && (
        <>
          {belowCount > 0 && (
            <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
              <span className="text-base">⚠</span>
              <span>
                <strong>{belowCount}</strong> student{belowCount > 1 ? 's are' : ' is'} below the attendance threshold.
              </span>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">
                {report.length} student{report.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      Student
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      Attended
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      Total Sessions
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap min-w-[180px]">
                      Attendance %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.map(row => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 ${row.below_threshold ? 'bg-amber-50' : ''}`}
                    >
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar user={row} />
                          <div>
                            <p className="font-medium text-gray-900">{row.name}</p>
                            <p className="text-xs text-gray-400">{row.email}</p>
                          </div>
                          {row.below_threshold && (
                            <span title="Below threshold" className="text-amber-500 text-base leading-none">
                              ⚠
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attended */}
                      <td className="px-4 py-3 text-gray-600">{row.attended}</td>

                      {/* Total */}
                      <td className="px-4 py-3 text-gray-600">{row.total_sessions}</td>

                      {/* Progress bar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                row.below_threshold ? 'bg-amber-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(row.percentage ?? 0, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-semibold w-10 text-right ${
                              row.below_threshold ? 'text-amber-600' : 'text-green-600'
                            }`}
                          >
                            {row.percentage ?? 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        className="w-8 h-8 rounded-full flex-shrink-0"
        alt=""
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
