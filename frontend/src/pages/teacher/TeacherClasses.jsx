import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function Spinner({ small }) {
  return (
    <div className={`flex justify-center ${small ? 'py-4' : 'py-12'}`}>
      <div className={`border-4 border-blue-500 border-t-transparent rounded-full animate-spin ${small ? 'w-5 h-5' : 'w-8 h-8'}`} />
    </div>
  );
}

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? '✓' : '✕'} {message}
    </div>
  );
}

function StudentRow({ student, mentors, subjectId, onMentorAssigned }) {
  const [selectedMentor, setSelectedMentor] = useState(
    () => student.current_mentor_id ? String(student.current_mentor_id) : ''
  );
  const [assigning, setAssigning] = useState(false);
  const [rowError, setRowError] = useState('');

  async function assignMentor() {
    if (!selectedMentor) return;
    setAssigning(true);
    setRowError('');
    try {
      await api.post(`/teacher/students/${student.id}/mentor`, { mentor_id: selectedMentor, subject_id: subjectId });
      onMentorAssigned(subjectId, 'BV Leader assigned');
    } catch (err) {
      setRowError(err.response?.data?.error || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <td className="px-3 py-2 text-xs font-mono text-gray-400 whitespace-nowrap">{student.roll_number || '—'}</td>
      <td className="px-3 py-2 text-sm text-gray-800 font-medium">{student.name}</td>
      <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">{student.current_mentor_name || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={selectedMentor}
            onChange={e => setSelectedMentor(e.target.value)}
          >
            <option value="">— Select BV Leader —</option>
            {mentors.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={assignMentor}
            disabled={!selectedMentor || assigning}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigning ? 'Saving…' : 'Assign'}
          </button>
          {rowError && <span className="text-xs text-red-600">{rowError}</span>}
        </div>
      </td>
    </tr>
  );
}

function SubjectCard({ subject, mentors, openingId, onStartSession, onMentorAssigned }) {
  const [expanded, setExpanded] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (students.length > 0) return;
    setLoadingStudents(true);
    setStudentsError('');
    try {
      const r = await api.get(`/teacher/students/${subject.id}`);
      setStudents(r.data);
    } catch (err) {
      setStudentsError(err.response?.data?.error || 'Failed to load students.');
    } finally {
      setLoadingStudents(false);
    }
  }

  function reloadStudents() {
    setLoadingStudents(true);
    setStudentsError('');
    api.get(`/teacher/students/${subject.id}`)
      .then(r => setStudents(r.data))
      .catch(err => setStudentsError(err.response?.data?.error || 'Failed to reload students.'))
      .finally(() => setLoadingStudents(false));
  }

  function handleMentorAssigned(subjectId, msg) {
    reloadStudents();
    onMentorAssigned(subjectId, msg);
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
          {subject.code}
        </span>
        <span className="text-xs text-gray-400">{subject.student_count} students</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{subject.name}</h3>
      <p className="text-xs text-gray-400 mb-4">
        Last session:{' '}
        {subject.last_session_date
          ? new Date(subject.last_session_date).toLocaleDateString()
          : 'Never'}
      </p>
      <button
        onClick={() => onStartSession(subject.id)}
        disabled={openingId === subject.id}
        className="btn-primary w-full text-sm disabled:opacity-60 mb-3"
      >
        {openingId === subject.id ? 'Opening…' : 'Start Session'}
      </button>
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1.5 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span>{expanded ? '▲ Hide' : `▼ Students (${subject.student_count})`}</span>
      </button>

      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {loadingStudents && <Spinner small />}
          {studentsError && (
            <p className="text-xs text-red-600 text-center py-2">{studentsError}</p>
          )}
          {!loadingStudents && !studentsError && (
            students.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No students enrolled.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Roll No</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">BV Leader</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(stu => (
                      <StudentRow
                        key={stu.id}
                        student={stu}
                        mentors={mentors}
                        subjectId={subject.id}
                        onMentorAssigned={handleMentorAssigned}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherClasses() {
  const [subjects, setSubjects] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // { message, type }
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/teacher/subjects'),
      api.get('/teacher/mentors').catch(() => ({ data: [] })),
    ])
      .then(([subjectsRes, mentorsRes]) => {
        setSubjects(subjectsRes.data);
        setMentors(mentorsRes.data);
      })
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoading(false));
  }, []);

  async function startSession(subjectId) {
    setOpeningId(subjectId);
    setError('');
    try {
      const r = await api.post('/teacher/sessions/open', { subject_id: subjectId });
      navigate(`/teacher/session/${r.data.session_id}`, {
        state: {
          pin: r.data.pin_display,
          expiresAt: r.data.expires_at,
        },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open session.');
    } finally {
      setOpeningId(null);
    }
  }

  const handleMentorAssigned = useCallback((subjectId, message) => {
    setToast({ message, type: 'success' });
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Classes</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium">No subjects assigned yet.</p>
          <p className="text-xs mt-1">Contact your administrator to get subjects assigned.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => (
            <SubjectCard
              key={s.id}
              subject={s}
              mentors={mentors}
              openingId={openingId}
              onStartSession={startSession}
              onMentorAssigned={handleMentorAssigned}
            />
          ))}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
