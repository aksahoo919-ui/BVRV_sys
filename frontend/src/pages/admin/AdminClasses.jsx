import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function AdminClasses() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [members, setMembers] = useState({ instructors: [], students: [] });
  const [allTeachers, setAllTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [addTeacherSelect, setAddTeacherSelect] = useState('');
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [removingTeacherId, setRemovingTeacherId] = useState(null);
  const [studentView, setStudentView] = useState('registered'); // 'registered' | 'add'
  const [busyStudent, setBusyStudent] = useState(null);

  useEffect(() => {
    api.get('/admin/subjects').then(r => setSubjects(r.data));
    api.get('/admin/users').then(r => {
      const users = r.data;
      setAllTeachers(users.filter(u => (u.role === 'teacher' || u.secondary_role === 'teacher') && u.status === 'active'));
      setAllStudents(users.filter(u => u.role === 'student' && u.status === 'active'));
    });
  }, []);

  async function loadMembers(subjectId) {
    setLoading(true);
    try {
      const r = await api.get(`/admin/classes/${subjectId}/members`);
      setMembers(r.data);
      setAddTeacherSelect('');
    } finally {
      setLoading(false);
    }
  }

  function handleSubjectChange(e) {
    setSelectedSubject(e.target.value);
    setMembers({ instructors: [], students: [] });
    setAddTeacherSelect('');
    if (e.target.value) loadMembers(e.target.value);
  }

  // Teachers already assigned
  const assignedTeacherIds = new Set(members.instructors.map(t => t.id));

  // Teachers available to add (not yet assigned)
  const availableTeachers = allTeachers.filter(t => !assignedTeacherIds.has(t.id));

  async function handleAddTeacher() {
    if (!addTeacherSelect) return;
    setAddingTeacher(true);
    try {
      await api.post('/admin/classes/assign-instructor', {
        subject_id: selectedSubject,
        instructor_id: addTeacherSelect,
      });
      await loadMembers(selectedSubject);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add teacher');
    } finally {
      setAddingTeacher(false);
    }
  }

  async function handleRemoveTeacher(teacherId) {
    setRemovingTeacherId(teacherId);
    try {
      await api.delete('/admin/classes/remove-instructor', {
        params: { subject_id: selectedSubject, instructor_id: teacherId },
      });
      await loadMembers(selectedSubject);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove teacher');
    } finally {
      setRemovingTeacherId(null);
    }
  }

  const enrolledStudentIds = new Set(members.students.map(s => s.id));
  const q = search.toLowerCase();
  const matchesSearch = (s) =>
    (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);

  // Registered = students enrolled in this subject
  const registeredStudents = members.students.filter(matchesSearch);
  // Other = active students not enrolled in this subject
  const otherStudents = allStudents.filter(s => !enrolledStudentIds.has(s.id)).filter(matchesSearch);

  async function handleAddStudent(studentId) {
    setBusyStudent(studentId);
    try {
      await api.post('/admin/classes/enroll-student', { subject_id: selectedSubject, student_id: studentId });
      await loadMembers(selectedSubject);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add student');
    } finally {
      setBusyStudent(null);
    }
  }

  async function handleRemoveStudent(studentId) {
    setBusyStudent(studentId);
    try {
      await api.delete('/admin/classes/remove-student', {
        params: { subject_id: selectedSubject, student_id: studentId },
      });
      await loadMembers(selectedSubject);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove student');
    } finally {
      setBusyStudent(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Class Management</h1>

      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
        <select className="input max-w-sm" value={selectedSubject} onChange={handleSubjectChange}>
          <option value="">— Choose a subject —</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>
      </div>

      {selectedSubject && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Teachers panel */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">
              Teachers ({members.instructors.length})
            </h2>

            {/* Assigned teachers list */}
            {members.instructors.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No teachers assigned.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {members.instructors.map(t => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveTeacher(t.id)}
                      disabled={removingTeacherId === t.id}
                      className="btn-danger py-1 px-2 text-xs flex-shrink-0"
                    >
                      {removingTeacherId === t.id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add teacher dropdown */}
            <div className="flex gap-2 items-center">
              <select
                className="input flex-1"
                value={addTeacherSelect}
                onChange={e => setAddTeacherSelect(e.target.value)}
                disabled={availableTeachers.length === 0}
              >
                <option value="">
                  {availableTeachers.length === 0 ? '— All teachers assigned —' : '— Add a teacher —'}
                </option>
                {availableTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
              <button
                onClick={handleAddTeacher}
                disabled={!addTeacherSelect || addingTeacher}
                className="btn-primary text-sm flex-shrink-0"
              >
                {addingTeacher ? 'Adding…' : 'Add Teacher'}
              </button>
            </div>
          </div>

          {/* Students panel */}
          <div className="card">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setStudentView('registered')}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  studentView === 'registered' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Registered ({members.students.length})
              </button>
              <button
                onClick={() => setStudentView('add')}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  studentView === 'add' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Add Students
              </button>
            </div>

            <input
              className="input mb-3"
              placeholder="Search students…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {studentView === 'registered' ? (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {registeredStudents.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveStudent(s.id)}
                      disabled={busyStudent === s.id}
                      className="text-xs font-medium py-1 px-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-60"
                    >
                      {busyStudent === s.id ? '…' : 'Remove'}
                    </button>
                  </div>
                ))}
                {registeredStudents.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {members.students.length === 0 ? 'No students enrolled yet.' : 'No matches.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {otherStudents.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.email}</p>
                    </div>
                    <button
                      onClick={() => handleAddStudent(s.id)}
                      disabled={busyStudent === s.id}
                      className="text-xs font-medium py-1 px-2 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors flex-shrink-0 disabled:opacity-60"
                    >
                      {busyStudent === s.id ? '…' : 'Add'}
                    </button>
                  </div>
                ))}
                {otherStudents.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No other students to add.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
