import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { className } from '../utils/classLabel';

// BV Leader portal: "+ Add member" (name, mobile, email, gender, optional course). The request goes to
// the admin; the devotee is added only after approval. The server checks whether the devotee is already
// in the portal and says so.

const CHIP = {
  pending: 'bg-amber-50 text-amber-700', approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};
const LABEL = { pending: 'Waiting for admin', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const EMPTY = { name: '', phone: '', email: '', gender: '', subject_id: '', note: '' };

// Returns the pieces so the page can put the button top right and the request list below the students.
export function useMemberRequests() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/mentor/member-requests').then(r => setData(r.data)).catch(() => setData({ requests: [], classes: [] }));
  }, []);
  useEffect(load, [load]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const r = await api.post('/mentor/member-requests', f);
      setOpen(false); setF(EMPTY);
      const ex = r.data.existing;
      setMsg(ex
        ? `Request sent. ${ex.name} is already in the portal${ex.leaders ? ` (BV Leader: ${ex.leaders})` : ''}${ex.courses ? `, course: ${ex.courses}` : ''}. The admin will put them under you after approval.`
        : 'Request sent. The admin will review it and the devotee is added after approval.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send the request');
    } finally { setSaving(false); }
  }
  async function cancel(id) {
    setError(''); setMsg('');
    try { await api.post(`/mentor/member-requests/${id}/cancel`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to cancel'); }
  }

  const requests = data?.requests || [];
  const button = <button onClick={() => { setOpen(true); setError(''); setMsg(''); }} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium whitespace-nowrap">+ Add new member</button>;
  const notices = (<>
    {msg && <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-3">{msg}</div>}
    {error && !open && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{error}</div>}
  </>);
  const list = requests.length > 0 ? (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Your member requests</h2>
      <p className="text-xs text-gray-400 mb-3">The devotee is added only after the admin approves.</p>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {requests.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{r.name}{r.phone ? <span className="text-gray-400 font-normal"> · {r.phone}</span> : null}</p>
                <p className="text-xs text-gray-400">
                  {fmt(r.created_at)} · {r.course_code ? `${className(r.course_name)} (${r.course_code})${r.semester_label ? ` · ${r.semester_label}` : ''}` : 'No course'}
                  {r.existing_name ? ` · already in portal as ${r.existing_name}` : ''}
                </p>
                {r.admin_note && <p className="text-xs text-gray-600 mt-0.5">Admin: {r.admin_note}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CHIP[r.status]}`}>{LABEL[r.status]}</span>
                {r.status === 'pending' && <button onClick={() => cancel(r.id)} className="text-xs text-gray-500 hover:underline">Cancel request</button>}
              </div>
            </div>
          ))}
        </div>
    </div>
  ) : null;

  const modal = (
    <>
  {open && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add a new member</h3>
          <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <label className="block text-sm"><span className="text-gray-600">Name <span className="text-red-500">*</span></span>
          <input className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} placeholder="Full name" /></label>
        <label className="block text-sm"><span className="text-gray-600">Mobile <span className="text-gray-400">(optional)</span></span>
          <input className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} placeholder="9876543210" /></label>
        <label className="block text-sm"><span className="text-gray-600">Email <span className="text-gray-400">(optional)</span></span>
          <input type="email" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} placeholder="name@example.com" /></label>
        <label className="block text-sm"><span className="text-gray-600">Gender <span className="text-gray-400">(optional)</span></span>
          <select className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" value={f.gender} onChange={e => setF(s => ({ ...s, gender: e.target.value }))}>
            <option value="">— Not set —</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
        <label className="block text-sm"><span className="text-gray-600">Course <span className="text-gray-400">(optional)</span></span>
          <select className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" value={f.subject_id} onChange={e => setF(s => ({ ...s, subject_id: e.target.value }))}>
            <option value="">— No course yet —</option>
            {(data?.classes || []).map(c => <option key={c.subject_id} value={c.subject_id}>{className(c.class_name || c.course_name)} ({c.code}){c.semester_label ? ` · ${c.semester_label}` : ''}</option>)}
          </select></label>
        <label className="block text-sm"><span className="text-gray-600">Note for the admin <span className="text-gray-400">(optional)</span></span>
          <textarea className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={2} maxLength={500} value={f.note} onChange={e => setF(s => ({ ...s, note: e.target.value }))} /></label>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving || !f.name.trim()} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60">{saving ? 'Sending…' : 'Send to admin'}</button>
          <button type="button" onClick={() => setOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  )}
    </>
  );
  return { button, notices, list, modal };
}
