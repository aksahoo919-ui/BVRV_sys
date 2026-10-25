import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import AttendanceRoster from '../../components/AttendanceRoster';
import { todayIST, fmtDayIST, fmtDateIST, fmtDateTimeIST, editableUntil } from '../../utils/datetime';

function Spinner() {
  return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-shyama-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function TeacherManualAttendance() {
  const [params] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(params.get('subject_id') || '');
  const [date, setDate] = useState(params.get('date') || todayIST());
  const [day, setDay] = useState(null); // { has_record, locked, recorded_at, session_count }
  const [roster, setRoster] = useState([]); // [{id, name, roll_number, status}]
  const [days, setDays] = useState([]);   // recorded days for the subject
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    api.get('/teacher/subjects').then(r => {
      setSubjects(r.data);
      if (!subjectId && r.data[0]) setSubjectId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  async function loadDay() {
    if (!subjectId || !date) return;
    setLoading(true); setError(''); setSavedMsg('');
    try {
      const r = await api.get('/teacher/attendance/day', { params: { subject_id: subjectId, date } });
      setDay(r.data);
      // A day with no record yet starts with everyone present.
      setRoster(r.data.roster.map(s => ({ ...s, status: s.status || 'present' })));
    } catch (e) { setError(e.response?.data?.error || 'Failed to load students'); setRoster([]); setDay(null); }
    finally { setLoading(false); }
  }

  async function loadDays() {
    if (!subjectId) return;
    try {
      const r = await api.get('/teacher/attendance/days', { params: { subject_id: subjectId } });
      setDays(r.data);
    } catch { setDays([]); }
  }

  useEffect(() => { loadDay(); }, [subjectId, date]);
  useEffect(() => { loadDays(); }, [subjectId]);

  function setStatus(id, status) {
    setRoster(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }
  function markAll(status, ids) {
    const only = new Set(ids);
    setRoster(prev => prev.map(s => only.has(s.id) ? { ...s, status } : s));
  }

  async function save() {
    if (!subjectId) return;
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const entries = roster.map(s => ({ student_id: s.id, status: s.status }));
      const r = await api.post('/teacher/attendance/manual', { subject_id: subjectId, session_date: date, entries });
      const d = r.data;
      await Promise.all([loadDay(), loadDays()]); // reload clears the message, so set it after
      setSavedMsg(`${d.updated ? 'Updated' : 'Recorded'} — ${d.present} present, ${d.service} service, ${d.absent} absent.`);
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const subject = subjects.find(s => String(s.id) === String(subjectId));
  const locked = !!day?.locked;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manual Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Mark or edit a class's attendance for a day. All sessions of a class on the same day are merged into one record.
          Records can be changed for 7 days after the class; older days are locked.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : subjectId && day && (
        <div className="card">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-800">{subject?.name} · {fmtDayIST(date)}</h2>
            {locked ? (
              <p className="mt-2 text-xs bg-gray-100 text-gray-600 rounded-md px-3 py-2">
                This day is locked — it could be changed until {fmtDateIST(editableUntil(date))}. Ask an admin for a correction.
              </p>
            ) : day.has_record ? (
              <p className="mt-2 text-xs bg-shyama-50 text-shyama-800 rounded-md px-3 py-2">
                ✎ Editing the saved record{day.session_count > 1 ? ` (${day.session_count} sessions merged)` : ''} — last recorded {fmtDateTimeIST(day.recorded_at)}.
                Editable until {fmtDateIST(editableUntil(date))}.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">No attendance recorded for this day yet. Editable until {fmtDateIST(editableUntil(date))}.</p>
            )}
          </div>

          <AttendanceRoster
            roster={roster}
            onStatus={setStatus}
            onMarkAll={markAll}
            disabled={locked}
            emptyText="No students enrolled in this subject."
          />

          {!locked && roster.length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : day.has_record ? 'Update Attendance' : 'Save Attendance'}
              </button>
              {savedMsg && <span className="text-temple-700 text-sm font-semibold inline-flex items-center min-h-[24px]">✓ {savedMsg}</span>}
            </div>
          )}
        </div>
      )}

      {subjectId && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-gray-800 text-sm">Attendance records</h2></div>
          {days.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500 text-sm">No attendance recorded for this subject yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {days.map(d => (
                <li
                  key={d.session_date}
                  onClick={() => setDate(d.session_date)}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer ${d.session_date === date ? 'bg-shyama-50/50' : ''}`}
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{fmtDayIST(d.session_date)}</p>
                    <p className="text-xs text-gray-500">
                      Recorded {fmtDateTimeIST(d.recorded_at)}{d.session_count > 1 ? ` · ${d.session_count} sessions merged` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 font-semibold">
                      {d.present_count}/{d.total_students} present{d.service_count ? ` · ${d.service_count} service` : ''}
                    </p>
                    {d.locked
                      ? <span className="text-xs text-gray-500">Locked</span>
                      : <span className="text-xs text-temple-700">Edit →</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
