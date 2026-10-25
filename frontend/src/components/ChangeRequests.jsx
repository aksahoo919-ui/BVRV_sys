import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { hasSemesters } from '../utils/classLabel';

// Student profile: current BV Leader and courses, and requests to change them.
// Nothing changes until an admin approves the request.

const STATUS_CHIP = {
  pending:   'bg-amber-50 text-amber-700',
  approved:  'bg-green-50 text-green-700',
  rejected:  'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};
const STATUS_LABEL = { pending: 'Waiting for admin', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const classLabel = c => `${c.course_name || c.code} (${c.code})${hasSemesters(c) ? ` · ${c.semester_label}` : ''}`;
const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function describeRequest(r) {
  if (r.kind === 'bv_leader') return `BV Leader → ${r.mentor_name || '(removed)'}`;
  const to = r.to_code ? `${r.to_course || ''} (${r.to_code})` : '(removed course)';
  return r.from_code ? `Course: ${r.from_course || ''} (${r.from_code}) → ${to}` : `Join course: ${to}`;
}

export default function ChangeRequests() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { kind, mentor_id | from_subject_id + to_subject_id, note }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/student/change-requests')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'));
  }, []);
  useEffect(load, [load]);

  const pending = kind => data?.requests.find(r => r.kind === kind && r.status === 'pending');

  async function submit() {
    setSaving(true); setError(''); setMsg('');
    try {
      await api.post('/student/change-requests', form);
      setForm(null);
      setMsg('Request sent. The admin will review it.');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send the request');
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id) {
    setError(''); setMsg('');
    try { await api.post(`/student/change-requests/${id}/cancel`); load(); }
    catch (e) { setError(e.response?.data?.error || 'Failed to cancel'); }
  }

  if (!data) return <div className="card mt-4">{error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-gray-500">Loading…</p>}</div>;

  const myIds = new Set(data.my_classes.map(c => c.subject_id));
  const myLeaderIds = new Set(data.my_leaders.map(l => l.mentor_id));

  return (
    <div className="card mt-4">
      <h2 className="font-semibold text-gray-900">BV Leader &amp; Course</h2>
      <p className="text-xs text-gray-500 mb-4">Something wrong? Ask for a correction. The admin approves it before anything changes.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">My BV Leader</p>
          <p className="text-sm text-gray-800">{data.my_leaders.length ? data.my_leaders.map(l => l.name).join(' / ') : <span className="text-gray-500 italic">Not set</span>}</p>
          {pending('bv_leader') ? (
            <p className="text-xs text-amber-700 mt-1">Change requested — waiting for admin</p>
          ) : (
            <button onClick={() => { setForm({ kind: 'bv_leader', mentor_id: '', note: '' }); setMsg(''); setError(''); }}
              className="text-xs text-primary-600 hover:underline mt-1 inline-flex items-center min-h-[24px]">Request a BV Leader change</button>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">My course (current semester)</p>
          {data.my_classes.length ? data.my_classes.map(c => <p key={c.subject_id} className="text-sm text-gray-800">{classLabel(c)}</p>)
            : <p className="text-sm text-gray-500 italic">Not in a course</p>}
          {pending('course') ? (
            <p className="text-xs text-amber-700 mt-1">Change requested — waiting for admin</p>
          ) : (
            <button onClick={() => { setForm({ kind: 'course', from_subject_id: data.my_classes[0]?.subject_id || '', to_subject_id: '', note: '' }); setMsg(''); setError(''); }}
              className="text-xs text-primary-600 hover:underline mt-1 inline-flex items-center min-h-[24px]">Request a course change</button>
          )}
        </div>
      </div>

      {form && (
        <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          {form.kind === 'bv_leader' ? (
            <>
              <label className="block text-sm font-medium text-gray-700">New BV Leader</label>
              <select className="input w-full" value={form.mentor_id} onChange={e => setForm(f => ({ ...f, mentor_id: e.target.value }))}>
                <option value="">— Pick your BV Leader —</option>
                {data.leaders.filter(l => !(myLeaderIds.size === 1 && myLeaderIds.has(l.id))).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700">Leave this course</label>
              <select className="input w-full" value={form.from_subject_id} onChange={e => setForm(f => ({ ...f, from_subject_id: e.target.value }))}>
                {data.my_classes.map(c => <option key={c.subject_id} value={c.subject_id}>{classLabel(c)}</option>)}
                <option value="">— Keep my courses, just add a new one —</option>
              </select>
              <label className="block text-sm font-medium text-gray-700">Join this course</label>
              <select className="input w-full" value={form.to_subject_id} onChange={e => setForm(f => ({ ...f, to_subject_id: e.target.value }))}>
                <option value="">— Pick the right course —</option>
                {data.classes.filter(c => !myIds.has(c.subject_id)).map(c => <option key={c.subject_id} value={c.subject_id}>{classLabel(c)}</option>)}
              </select>
            </>
          )}
          <label className="block text-sm font-medium text-gray-700">Note for the admin <span className="text-gray-500 font-normal">(optional)</span></label>
          <textarea className="input w-full" rows={2} maxLength={500} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. I attend the Telugu batch, not English" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving || (form.kind === 'bv_leader' ? !form.mentor_id : !form.to_subject_id)} className="btn-primary text-sm px-4 py-2">
              {saving ? 'Sending…' : 'Send to admin'}
            </button>
            <button onClick={() => setForm(null)} className="text-sm px-4 py-2 rounded-md border border-gray-200 text-gray-600 hover:bg-white">Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {msg && <p className="text-sm text-green-700 mt-3">{msg}</p>}

      {data.requests.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">My requests</p>
          <div className="space-y-2">
            {data.requests.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{describeRequest(r)}</p>
                  <p className="text-xs text-gray-500">{fmt(r.created_at)}{r.note ? ` · “${r.note}”` : ''}</p>
                  {r.admin_note && <p className="text-xs text-gray-600 mt-0.5">Admin: {r.admin_note}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {r.status === 'pending' && <button onClick={() => cancel(r.id)} className="text-xs text-gray-500 hover:underline inline-flex items-center min-h-[24px]">Cancel request</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
