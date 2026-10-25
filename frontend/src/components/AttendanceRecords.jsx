import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import AttendanceRoster from './AttendanceRoster';
import { todayIST, fmtDayIST, fmtDateIST, fmtDateTimeIST, editableUntil } from '../utils/datetime';

// View a class's attendance for a chosen date. Within 7 days of the class the
// teacher / BV Leader can switch to edit mode and change statuses.
//   role="teacher" — pick a subject; one merged record per subject per day
//   role="mentor"  — the BV Leader's common class; one merged record per day
const API = {
  teacher: {
    load: (subjectId, date) => api.get('/teacher/attendance/day', { params: { subject_id: subjectId, date } }),
    save: (subjectId, date, entries) => api.post('/teacher/attendance/manual', { subject_id: subjectId, session_date: date, entries }),
  },
  mentor: {
    load: (_, date) => api.get('/mentor/attendance/day', { params: { date } }),
    save: (_, date, entries) => api.post('/mentor/attendance/day', { date, entries }),
  },
};

function Spinner() {
  return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function AttendanceRecords({ role }) {
  const isTeacher = role === 'teacher';
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(() => todayIST());
  const [day, setDay] = useState(null);
  const [roster, setRoster] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!isTeacher) return;
    api.get('/teacher/subjects').then(r => {
      setSubjects(r.data);
      if (r.data[0]) setSubjectId(String(r.data[0].id));
    }).catch(() => {});
  }, [isTeacher]);

  async function load() {
    if (isTeacher && !subjectId) return;
    setLoading(true); setError(''); setEditing(false);
    try {
      const r = await API[role].load(subjectId, date);
      setDay(r.data);
      setRoster(r.data.roster);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load attendance'); setDay(null); setRoster([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { setSavedMsg(''); load(); }, [subjectId, date]);

  function startEdit() {
    // A day with nothing recorded starts with everyone present.
    setRoster(prev => prev.map(s => ({ ...s, status: s.status || 'present' })));
    setSavedMsg('');
    setEditing(true);
  }

  function setStatus(id, status) {
    setRoster(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }
  function markAll(status, ids) {
    const only = new Set(ids);
    setRoster(prev => prev.map(s => only.has(s.id) ? { ...s, status } : s));
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await API[role].save(subjectId, date, roster.map(s => ({ student_id: s.id, status: s.status })));
      await load();
      setSavedMsg('Attendance saved.');
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const subject = subjects.find(s => String(s.id) === String(subjectId));
  const locked = !!day?.locked;
  // Unrecorded days show as "—" in view mode; give the roster a neutral status.
  const viewRoster = roster.map(s => ({ ...s, status: s.status || 'none' }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Attendance Records</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pick a date to see the attendance{isTeacher ? ' of a class' : ' of your weekly class'}. All sessions on the same day are merged.
          Attendance can be changed for 7 days after the class.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card flex flex-wrap items-end gap-3">
        {isTeacher && (
          <div className="flex-1 min-w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">— Select —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
        )}
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} max={todayIST()} onChange={e => e.target.value && setDate(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : day && (
        <div className="card">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="font-semibold text-gray-800">
                {isTeacher ? `${subject?.name || 'Class'} · ` : ''}{fmtDayIST(date)}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {day.has_record
                  ? `Recorded ${fmtDateTimeIST(day.recorded_at)}${day.session_count > 1 ? ` · ${day.session_count} sessions merged` : ''}`
                  : 'No attendance recorded on this date.'}
              </p>
              <p className={`text-xs mt-1 ${locked ? 'text-gray-500' : 'text-blue-600'}`}>
                {locked
                  ? `🔒 Locked — could be changed until ${fmtDateIST(editableUntil(date))}.`
                  : `✎ Can be changed until ${fmtDateIST(editableUntil(date))}.`}
              </p>
            </div>
            {!locked && !editing && roster.length > 0 && (
              <button onClick={startEdit} className="btn-primary">
                {day.has_record ? 'Change attendance' : 'Record attendance'}
              </button>
            )}
          </div>

          {(day.has_record || editing) ? (
            <AttendanceRoster
              roster={editing ? roster : viewRoster}
              onStatus={setStatus}
              onMarkAll={editing ? markAll : undefined}
              disabled={!editing}
              emptyText={isTeacher ? 'No students enrolled in this class.' : 'No students assigned to you.'}
            />
          ) : (
            <p className="text-center py-8 text-gray-500 text-sm">
              {roster.length ? 'Nothing recorded for this date.' : (isTeacher ? 'No students enrolled in this class.' : 'No students assigned to you.')}
            </p>
          )}

          {editing && (
            <div className="flex items-center gap-3 mt-4">
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
              <button onClick={load} disabled={saving} className="btn-secondary">Cancel</button>
            </div>
          )}
          {savedMsg && !editing && <p className="text-temple-700 text-sm font-semibold mt-3 inline-flex items-center min-h-[24px]">✓ {savedMsg}</p>}
        </div>
      )}
    </div>
  );
}
