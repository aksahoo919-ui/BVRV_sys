import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function Spinner() { return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>; }

export default function TeacherAttendanceCorrections() {
  const [corrections, setCorrections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ session_id:'', student_id:'', original_status:'absent', requested_status:'present', reason:'' });
  const [sessionStudents, setSessionStudents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cr, sr] = await Promise.all([
        api.get('/teacher/attendance-corrections'),
        api.get('/teacher/subjects'),
      ]);
      setCorrections(cr.data);
      // We'll use session live attendance to build session dropdown
      setSessions(sr.data); // subjects as proxy for sessions
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function loadSessionStudents(sessionId) {
    if (!sessionId) { setSessionStudents([]); return; }
    try {
      const r = await api.get(`/teacher/sessions/${sessionId}/live`);
      setSessionStudents(r.data);
    } catch { setSessionStudents([]); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(''); setSubmitting(true);
    try {
      await api.post('/teacher/attendance-corrections', form);
      setSubmitted(true);
      setForm({ session_id:'', student_id:'', original_status:'absent', requested_status:'present', reason:'' });
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
            <input className="input" placeholder="Paste session UUID" value={form.session_id}
              onChange={e => { setForm(f=>({...f, session_id: e.target.value, student_id:''})); loadSessionStudents(e.target.value); }} />
            <p className="text-xs text-gray-400 mt-0.5">Find session ID in the session view after it closes.</p>
          </div>
          {sessionStudents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select className="input" required value={form.student_id} onChange={e => setForm(f=>({...f, student_id: e.target.value}))}>
                <option value="">— Select —</option>
                {sessionStudents.map(s => <option key={s.student_id} value={s.student_id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {!sessionStudents.length && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <input className="input" placeholder="Student UUID" value={form.student_id}
                onChange={e => setForm(f=>({...f, student_id: e.target.value}))} required />
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
              <select className="input" value={form.original_status} onChange={e => setForm(f=>({...f, original_status: e.target.value}))}>
                {['present','absent','late','flagged'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested Status</label>
              <select className="input" value={form.requested_status} onChange={e => setForm(f=>({...f, requested_status: e.target.value}))}>
                {['present','absent','late'].map(s => <option key={s} value={s}>{s}</option>)}
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
          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Submitting…' : 'Submit Request'}</button>
        </form>
      </div>

      {/* My submissions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">My Submitted Corrections</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {loading ? <Spinner /> : corrections.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">No correction requests yet.</div>
        ) : (
          <div className="space-y-3">
            {corrections.map(c => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800">{c.student_name}</p>
                    <p className="text-xs text-gray-500">{c.subject_name} · {new Date(c.session_date).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400 mt-1">{c.original_status} → {c.requested_status}</p>
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
