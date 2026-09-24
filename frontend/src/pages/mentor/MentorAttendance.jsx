import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import AttendanceRoster from '../../components/AttendanceRoster';
import { todayIST, fmtDayIST, fmtDateIST, fmtDateTimeIST, lockDateFor } from '../../utils/datetime';

function Spinner() {
  return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function MentorAttendance() {
  const [sessions, setSessions] = useState([]); // one row per day (sessions merged)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // new session form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => todayIST());
  const [creating, setCreating] = useState(false);

  // marking
  const [activeSession, setActiveSession] = useState(null);
  const [roster, setRoster] = useState([]); // [{id, name, roll_number, status}]
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // code-based attendance
  const [code, setCode] = useState(null); // { session_id, pin, expires_at }
  const [generating, setGenerating] = useState(false);

  async function loadSessions() {
    setLoading(true); setError('');
    try {
      const r = await api.get('/mentor/sessions');
      setSessions(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load sessions'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSessions(); }, []);

  async function createSession(e) {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      // Reuses the existing record if this day already has one.
      const r = await api.post('/mentor/sessions', { title: title || null, session_date: date });
      setTitle('');
      await loadSessions();
      openSession(r.data.id);
    } catch (e) { setError(e.response?.data?.error || 'Failed to create session'); }
    finally { setCreating(false); }
  }

  async function generateCode() {
    setGenerating(true); setError(''); setCode(null);
    try {
      const r = await api.post('/mentor/sessions/open-code', { title: title || null, session_date: date });
      setCode(r.data);
      await loadSessions();
    } catch (e) { setError(e.response?.data?.error || 'Failed to generate code'); }
    finally { setGenerating(false); }
  }

  async function openSession(sessionId) {
    setLoadingRoster(true); setSavedMsg(''); setError('');
    try {
      const r = await api.get(`/mentor/sessions/${sessionId}/attendance`);
      setActiveSession(r.data.session);
      setRoster(r.data.roster.map(s => ({ ...s, status: s.status || 'present' })));
    } catch (e) { setError(e.response?.data?.error || 'Failed to load roster'); }
    finally { setLoadingRoster(false); }
  }

  function setStatus(studentId, status) {
    setRoster(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  }

  function markAll(status, ids) {
    const only = new Set(ids);
    setRoster(prev => prev.map(s => only.has(s.id) ? { ...s, status } : s));
  }

  async function save() {
    if (!activeSession) return;
    setSaving(true); setError('');
    try {
      const entries = roster.map(s => ({ student_id: s.id, status: s.status }));
      const r = await api.post(`/mentor/sessions/${activeSession.id}/attendance`, { entries });
      setSavedMsg(`Saved attendance for ${r.data.saved} student(s).`);
      await loadSessions();
    } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const locked = !!activeSession?.locked;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Weekly Class Attendance</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          One common weekly class for all your students. Sessions held on the same day are merged into one record.
          Records can be changed until the Saturday after the following week, when they lock.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* New session */}
      <form onSubmit={createSession} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Session title <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input" placeholder="e.g. Bhagavad Gita — Ch 2" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? 'Opening…' : '+ Manual Session'}
        </button>
        <button type="button" onClick={generateCode} className="btn-secondary" disabled={generating}>
          {generating ? 'Generating…' : '🔢 Generate Code'}
        </button>
      </form>

      {/* Live code display */}
      {code && (
        <div className="card bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">Attendance code (5 min)</p>
            <p className="text-4xl font-mono font-bold text-emerald-800 tracking-widest mt-1">{code.pin}</p>
            <p className="text-xs text-emerald-600 mt-1">Students enter this PIN in their Mark Attendance screen.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openSession(code.session_id)} className="btn-secondary text-sm">View who's present →</button>
            <button onClick={() => setCode(null)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Dismiss</button>
          </div>
        </div>
      )}

      {/* Marking panel */}
      {activeSession && (
        <div className="card">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-800">{activeSession.title || 'Session'} · {fmtDayIST(activeSession.session_date)}</h2>
            {locked ? (
              <p className="mt-2 text-xs bg-gray-100 text-gray-600 rounded-md px-3 py-2">
                🔒 This day is locked — attendance locked on {fmtDateIST(lockDateFor(activeSession.session_date))}.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Editable until {fmtDateIST(lockDateFor(activeSession.session_date))}.</p>
            )}
          </div>

          {loadingRoster ? <Spinner /> : (
            <>
              <AttendanceRoster
                roster={roster}
                onStatus={setStatus}
                onMarkAll={markAll}
                disabled={locked}
                emptyText="No students assigned to you in this class."
              />
              {!locked && (
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={save} disabled={saving || roster.length === 0} className="btn-primary">
                    {saving ? 'Saving…' : 'Save Attendance'}
                  </button>
                  {savedMsg && <span className="text-emerald-600 text-sm font-semibold">✓ {savedMsg}</span>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Past days */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-gray-800 text-sm">Attendance records</h2></div>
        {loading ? <Spinner /> : sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">No sessions yet for this class.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map(s => (
              <li key={s.session_date} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => openSession(s.id)}>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{fmtDayIST(s.session_date)}</p>
                  <p className="text-xs text-gray-400">
                    {s.title || 'Session'}{s.session_count > 1 ? ` · ${s.session_count} sessions merged` : ''}
                    {s.last_marked_at ? ` · last marked ${fmtDateTimeIST(s.last_marked_at)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 font-semibold">
                    {s.present_count} present{s.service_count ? ` · ${s.service_count} service` : ''}
                  </p>
                  {s.locked
                    ? <span className="text-xs text-gray-400">🔒 Locked · view</span>
                    : <span className="text-xs text-emerald-600">Mark / edit →</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
