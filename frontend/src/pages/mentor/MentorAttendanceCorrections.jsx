import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import SearchableSelect from '../../components/SearchableSelect';
import DevoteeName, { devoteeDisplayLabel } from '../../components/DevoteeName';

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function formatSessionDate(str) {
  if (!str) return '';
  return new Date(`${str}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

// BV Leader's attendance-corrections page — the BV side had no way to request
// a correction at all until 27 Oct 2026 (Lakshminadh Prabhu's feedback, point 1).
// Mirrors TeacherAttendanceCorrections, against /mentor/attendance-corrections.
export default function MentorAttendanceCorrections() {
  const [corrections, setCorrections] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ session_id:'', student_id:'', original_status:'absent', requested_status:'present', reason:'' });
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cr, sr] = await Promise.all([
        api.get('/mentor/attendance-corrections'),
        api.get('/mentor/sessions'),
      ]);
      setCorrections(cr.data);
      setRecentSessions(sr.data.slice(0, 20));
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const sessionOptions = recentSessions.map(s => ({
    value: s.id,
    searchText: `${formatSessionDate(s.session_date)} ${s.title || ''}`,
    label: <span>{formatSessionDate(s.session_date)}{s.title ? ` — ${s.title}` : ''}</span>,
  }));

  async function onSessionChange(sessionId) {
    setForm(f => ({ ...f, session_id: sessionId, student_id: '', original_status: 'absent' }));
    setRoster([]);
    if (!sessionId) return;
    setRosterLoading(true);
    try {
      const r = await api.get(`/mentor/sessions/${sessionId}/attendance`);
      setRoster(r.data.roster || []);
    } catch { setRoster([]); }
    finally { setRosterLoading(false); }
  }

  function onStudentChange(studentId) {
    const s = roster.find(x => x.id === studentId);
    setForm(f => ({ ...f, student_id: studentId, original_status: s?.status || 'absent' }));
  }

  const studentOptions = roster.map(s => ({
    value: s.id,
    searchText: `${devoteeDisplayLabel(s.name, s.initiated_name)} ${s.roll_number || ''}`,
    label: <DevoteeName name={s.name} initiatedName={s.initiated_name} primaryClassName="font-medium text-gray-900" secondaryClassName="text-xs text-gray-500" truncate={false} />,
  }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(''); setSubmitting(true);
    try {
      await api.post('/mentor/attendance-corrections', form);
      setSubmitted(true);
      setForm({ session_id:'', student_id:'', original_status:'absent', requested_status:'present', reason:'' });
      setRoster([]);
      setTimeout(() => setSubmitted(false), 3000);
      await load();
    } catch (err) { setSubmitError(err.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Attendance Corrections</h1>

      {/* Submit form */}
      <div className="card max-w-lg">
        <h2 className="font-semibold text-gray-800 mb-4">Submit Correction Request</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BV class date</label>
            <SearchableSelect
              options={sessionOptions}
              value={form.session_id}
              onChange={onSessionChange}
              placeholder="Search by date…"
              emptyText="No recent BV classes"
            />
            <p className="text-xs text-gray-500 mt-0.5">Pick the date the BV class was held.</p>
          </div>
          {form.session_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <SearchableSelect
                options={studentOptions}
                value={form.student_id}
                onChange={onStudentChange}
                placeholder={rosterLoading ? 'Loading roster…' : 'Search by name…'}
                disabled={rosterLoading}
                emptyText="No students found for this date"
              />
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
              <select className="input" value={form.original_status} onChange={e => setForm(f=>({...f, original_status: e.target.value}))}>
                {['present','absent','service'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested Status</label>
              <select className="input" value={form.requested_status} onChange={e => setForm(f=>({...f, requested_status: e.target.value}))}>
                {['present','absent','service'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea className="input" rows={3} required placeholder="Explain why the correction is needed…"
              value={form.reason} onChange={e => setForm(f=>({...f, reason: e.target.value}))} />
          </div>
          {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
          {submitted && <p className="text-green-600 text-sm">✓ Correction request submitted</p>}
          <button type="submit" disabled={submitting || !form.session_id || !form.student_id} className="btn-primary w-full">{submitting ? 'Submitting…' : 'Submit Request'}</button>
        </form>
      </div>

      {/* My submissions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">My Submitted Corrections</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {loading ? <Spinner /> : corrections.length === 0 ? (
          <div className="card text-center text-gray-500 py-10">No correction requests yet.</div>
        ) : (
          <div className="space-y-3">
            {corrections.map(c => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DevoteeName name={c.student_name} initiatedName={c.student_initiated_name} primaryClassName="font-medium text-gray-800" truncate={false} />
                    <p className="text-xs text-gray-500">{formatSessionDate(c.session_date)}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.original_status} → {c.requested_status}</p>
                    <p className="text-sm text-gray-600 mt-1 italic">"{c.reason}"</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[c.status]||'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
