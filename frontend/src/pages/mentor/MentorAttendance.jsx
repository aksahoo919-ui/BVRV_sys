import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MentorAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // new session form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    api.get('/mentor/subjects').then(r => {
      setSubjects(r.data);
      if (r.data[0]) setSubjectId(String(r.data[0].id));
    }).catch(() => setError('Failed to load your classes'));
  }, []);

  async function loadSessions() {
    if (!subjectId) return;
    setLoading(true); setError('');
    try {
      const r = await api.get(`/mentor/sessions?subject_id=${subjectId}`);
      setSessions(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load sessions'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSessions(); setActiveSession(null); }, [subjectId]);

  async function createSession(e) {
    e.preventDefault();
    if (!subjectId) return;
    setCreating(true); setError('');
    try {
      const r = await api.post('/mentor/sessions', { subject_id: subjectId, title: title || null, session_date: date });
      setTitle('');
      await loadSessions();
      openSession(r.data.id);
    } catch (e) { setError(e.response?.data?.error || 'Failed to create session'); }
    finally { setCreating(false); }
  }

  async function generateCode() {
    if (!subjectId) return;
    setGenerating(true); setError(''); setCode(null);
    try {
      const r = await api.post('/mentor/sessions/open-code', { subject_id: subjectId, title: title || null, session_date: date });
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

  function markAll(status) {
    setRoster(prev => prev.map(s => ({ ...s, status })));
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

  const presentCount = roster.filter(s => s.status === 'present').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Weekly Class Attendance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Create a weekly session and mark attendance manually.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class (Subject)</label>
        <select className="input max-w-md" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">— Select class —</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.code} — {s.name} · {s.student_count} student(s)</option>
          ))}
        </select>
      </div>

      {/* New session */}
      <form onSubmit={createSession} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Session title <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input" placeholder="e.g. Bhagavad Gita — Ch 2" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={!subjectId || creating}>
          {creating ? 'Creating…' : '+ Manual Session'}
        </button>
        <button type="button" onClick={generateCode} className="btn-secondary" disabled={!subjectId || generating}>
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
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-800">{activeSession.title || 'Session'} · {fmtDate(activeSession.session_date)}</h2>
              <p className="text-xs text-gray-400">{presentCount} / {roster.length} present</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="text-xs px-3 py-1 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">All present</button>
              <button onClick={() => markAll('absent')} className="text-xs px-3 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50">All absent</button>
            </div>
          </div>

          {loadingRoster ? <Spinner /> : (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Roll No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {roster.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-8 text-gray-400">No students assigned to you in this class.</td></tr>
                    )}
                    {roster.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.roll_number || '—'}</td>
                        <td className="px-4 py-2 text-gray-800 font-medium">{s.name}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setStatus(s.id, 'present')}
                              className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors ${
                                s.status === 'present' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >Present</button>
                            <button
                              type="button"
                              onClick={() => setStatus(s.id, 'absent')}
                              className={`text-xs font-medium px-3 py-1 rounded-md border transition-colors ${
                                s.status === 'absent' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >Absent</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving || roster.length === 0} className="btn-primary">
                  {saving ? 'Saving…' : 'Save Attendance'}
                </button>
                {savedMsg && <span className="text-emerald-600 text-sm font-semibold">✓ {savedMsg}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Past sessions */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-gray-800 text-sm">Sessions</h2></div>
        {loading ? <Spinner /> : sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">No sessions yet for this class.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map(s => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => openSession(s.id)}>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{s.title || 'Session'}</p>
                  <p className="text-xs text-gray-400">{fmtDate(s.session_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 font-semibold">{s.present_count} present · {s.absent_count} absent</p>
                  <span className="text-xs text-emerald-600">Mark / edit →</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
