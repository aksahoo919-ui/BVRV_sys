import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { classYear } from '../../utils/classLabel';

const fmtMonth = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '');

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

function StudentRow({ index, student, mentors, subjectId, onMentorAssigned }) {
  const [selectedMentor, setSelectedMentor] = useState(
    () => student.current_mentor_id ? String(student.current_mentor_id) : ''
  );
  const [assigning, setAssigning] = useState(false);
  const [rowError, setRowError] = useState('');
  const changed = selectedMentor !== (student.current_mentor_id ? String(student.current_mentor_id) : '');

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
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{index}</td>
      <td className="px-3 py-2 text-sm text-gray-900 font-medium">{student.name}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{student.initiated_name || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">{student.phone || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[12rem]"
            value={selectedMentor}
            onChange={e => setSelectedMentor(e.target.value)}
          >
            <option value="">— No BV Leader —</option>
            {mentors.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {changed && selectedMentor && (
            <button
              onClick={assignMentor}
              disabled={assigning}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {assigning ? 'Saving…' : 'Save'}
            </button>
          )}
          {rowError && <span className="text-xs text-red-600">{rowError}</span>}
        </div>
      </td>
    </tr>
  );
}

// Full-width student list of the class the teacher picked (the cards above are too narrow for a table).
function StudentsPanel({ subject, mentors, onMentorAssigned, onClose }) {
  const panelRef = useRef(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.get(`/teacher/students/${subject.id}`)
      .then(r => setStudents(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load students.'))
      .finally(() => setLoading(false));
  }, [subject.id]);
  useEffect(load, [load]);

  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const shown = !q ? students : students.filter(s =>
    s.name?.toLowerCase().includes(q) || s.initiated_name?.toLowerCase().includes(q) ||
    s.current_mentor_name?.toLowerCase().includes(q) ||
    (qDigits.length >= 3 && String(s.phone || '').replace(/\D/g, '').includes(qDigits)));

  // Bring the panel into view when it opens (on phones it sits below the class cards)
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div ref={panelRef} className="card mt-6 scroll-mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">{subject.name} <span className="font-mono text-xs text-blue-600 ml-1">{subject.code}</span></h2>
          <p className="text-xs text-gray-500">{[subject.semester_label, subject.topic].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-gray-400">{students.length} students{q ? ` · ${shown.length} match` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, initiated name, phone or BV Leader…"
            className="w-full sm:w-72 max-w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={onClose} className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Close</button>
        </div>
      </div>
      {loading && <Spinner small />}
      {error && <p className="text-xs text-red-600 text-center py-2">{error}</p>}
      {!loading && !error && (shown.length === 0
        ? <p className="text-sm text-gray-400 text-center py-6">{students.length === 0 ? 'No students enrolled.' : 'No student matches your search.'}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Initiated name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Phone</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">BV Leader</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((stu, i) => (
                  <StudentRow
                    key={stu.id}
                    index={i + 1}
                    student={stu}
                    mentors={mentors}
                    subjectId={subject.id}
                    onMentorAssigned={(sid, msg) => { load(); onMentorAssigned(sid, msg); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function SubjectCard({ subject, openingId, selected, onStartSession, onToggleStudents }) {
  return (
    <div className={`card hover:shadow-md transition-shadow ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
          {subject.code}
        </span>
        <span className="text-xs text-gray-400">{subject.student_count} students</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{subject.name}</h3>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs mb-3">
        <dt className="text-gray-400">Year</dt>
        <dd className="text-gray-700">{subject.course_name || subject.course_code || '—'}{classYear(subject.code) ? ` · Year ${classYear(subject.code)}` : ''}</dd>
        <dt className="text-gray-400">Semester</dt>
        <dd className="text-gray-700">
          {subject.semester_label || '—'}
          {subject.semester_start && <span className="text-gray-400"> ({fmtMonth(subject.semester_start)} – {fmtMonth(subject.semester_end)})</span>}
        </dd>
        <dt className="text-gray-400">Subject</dt>
        <dd className={subject.topic ? 'text-gray-900 font-medium' : 'text-gray-400'}>{subject.topic || 'To be announced'}</dd>
      </dl>
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
        onClick={() => onToggleStudents(subject.id)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {selected ? '▲ Hide students' : `View students (${subject.student_count})`}
      </button>
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
  const [selectedId, setSelectedId] = useState(null);
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

  const selected = subjects.find(s => s.id === selectedId);

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
              openingId={openingId}
              selected={selectedId === s.id}
              onStartSession={startSession}
              onToggleStudents={id => setSelectedId(cur => (cur === id ? null : id))}
            />
          ))}
        </div>
      )}

      {selected && (
        <StudentsPanel
          key={selected.id}
          subject={selected}
          mentors={mentors}
          onMentorAssigned={handleMentorAssigned}
          onClose={() => setSelectedId(null)}
        />
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
