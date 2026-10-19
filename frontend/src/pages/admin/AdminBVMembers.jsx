import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import StudentTimelineModal from '../../components/StudentTimelineModal';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const csvCell = v => {
  const t = v == null ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

// Add a student (existing or new) to the selected BV Leader in one class of the current semester.
function AddMemberModal({ leader, onClose, onAdded }) {
  const [mode, setMode] = useState('existing');
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [q, setQ] = useState('');
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/users').then(r => setStudents(r.data.filter(u => u.role === 'student'))).catch(() => setError('Failed to load students'));
    api.get('/admin/subjects').then(r => setClasses(r.data.filter(s => s.semester_is_current && s.code !== 'TEST'))).catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return students.filter(u => [u.name, u.phone, u.email].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 30);
  }, [q, students]);
  const picked = students.find(u => u.id === studentId);

  async function save() {
    setBusy(true); setError('');
    try {
      const body = mode === 'existing'
        ? { subject_id: subjectId, student_id: studentId }
        : { subject_id: subjectId, new_student: { ...form, gender: form.gender || null } };
      const r = await api.post(`/admin/bv-members/${leader.id}/members`, body);
      const who = mode === 'existing' ? picked?.name : form.name.trim();
      onAdded(r.data.previous_leader
        ? `Added. ${who} was with ${r.data.previous_leader} in that class and is now with ${leader.name}.`
        : `Added ${who} to ${leader.name}.`);
    } catch (e) { setError(e.response?.data?.error || 'Could not add the member'); }
    finally { setBusy(false); }
  }

  const ready = subjectId && (mode === 'existing' ? studentId : form.name.trim());
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Add BV Member: {leader.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {[['existing', 'Existing student'], ['new', 'New student']].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id); setError(''); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${mode === id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'existing' ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            {picked ? (
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{picked.name}</p>
                  <p className="text-xs text-gray-400">{picked.phone || picked.email} · {picked.course || 'no class'} · BV Leader: {picked.bv_leader || '—'}</p>
                </div>
                <button onClick={() => setStudentId('')} className="text-xs text-primary-600 hover:underline">Change</button>
              </div>
            ) : (
              <>
                <input className="input mb-1" placeholder="Type a name, phone or email…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
                <div className="border border-gray-100 rounded-lg mb-3 max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {q.trim().length < 2 ? <p className="text-xs text-gray-400 px-3 py-2">Type at least 2 letters.</p>
                    : matches.length === 0 ? <p className="text-xs text-gray-400 px-3 py-2">No student found. Use "New student".</p>
                    : matches.map(u => (
                      <button key={u.id} onClick={() => setStudentId(u.id)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                        <p className="text-sm text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.phone || u.email} · {u.course || 'no class'} · BV Leader: {u.bv_leader || '—'}</p>
                      </button>
                    ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input mb-3" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input mb-3" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="email" className="input mb-3" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select className="input mb-3" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Class (current semester) <span className="text-red-500">*</span></label>
        <select className="input mb-3" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">— Select class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}{c.semester_id ? ` · ${c.semester_label}` : ''}</option>)}
        </select>
        <p className="text-xs text-gray-400 mb-3">The student is enrolled in this class if not already, and linked to {leader.name} there.</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy || !ready} className="btn-primary flex-1">{busy ? 'Adding…' : 'Add BV Member'}</button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBVMembers() {
  const [leaders, setLeaders] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [timelineFor, setTimelineFor] = useState(null);

  function loadLeaders() {
    api.get('/admin/bv-members/leaders')
      .then(r => setLeaders(r.data))
      .catch(() => setError('Failed to load BV Leaders'));
  }
  useEffect(() => { loadLeaders(); }, []);

  function loadMembers() {
    if (!leaderId) { setData(null); return; }
    setLoading(true); setError('');
    api.get(`/admin/bv-members/${leaderId}`)
      .then(r => setData(r.data))
      .catch(e => { setData(null); setError(e.response?.data?.error || 'Failed to load members'); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { setSearch(''); setNotice(''); loadMembers(); }, [leaderId]);

  const members = data?.members || [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      [m.name, m.email, m.phone, m.roll_number, m.classes].some(v => String(v || '').toLowerCase().includes(q)));
  }, [members, search]);

  function exportCsv() {
    const rows = [['Name', 'Email', 'Phone', 'Roll No', 'Current BVRV Class', 'Semester'],
      ...shown.map(m => [m.name, m.email, m.phone, m.roll_number, m.classes, m.semester])];
    const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bv_members_${(data?.leader?.name || 'leader').replace(/[^\w]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">BV Members</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pick a BV Leader to see the students assigned to them. Add a member here or on the Class BV Leaders page. Click a name for the student's timeline.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{notice}</div>}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">BV Leader</label>
        <select className="input max-w-md" value={leaderId} onChange={e => setLeaderId(e.target.value)}>
          <option value="">— Select BV Leader —</option>
          {leaders.map(l => <option key={l.id} value={l.id}>{l.name} ({l.member_count})</option>)}
        </select>
      </div>

      {!leaderId ? (
        <div className="card text-center py-10 text-gray-400 text-sm">Select a BV Leader to see their members.</div>
      ) : loading ? <Spinner /> : data && (
        <div className="card overflow-x-auto p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="mr-auto">
              <p className="font-semibold text-gray-900">{data.leader.name}</p>
              <p className="text-xs text-gray-400">
                {data.count} member{data.count === 1 ? '' : 's'}
                {search && ` · ${shown.length} shown`}
              </p>
            </div>
            <input
              className="input py-1.5 text-sm max-w-xs"
              placeholder="Search name, email, phone, class…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button onClick={exportCsv} disabled={shown.length === 0} className="btn-secondary text-sm">Export CSV</button>
            <button onClick={() => { setNotice(''); setShowAdd(true); }} className="btn-primary text-sm">+ Add BV Member</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">BV Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Current BVRV Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Semester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">
                  {data.count === 0 ? 'No members are assigned to this BV Leader yet.' : 'No members match your search.'}
                </td></tr>
              ) : shown.map((m, i) => (
                <tr key={m.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setTimelineFor({ id: m.student_id, name: m.name })} className="font-medium text-gray-800 hover:text-primary-600 hover:underline text-left">{m.name}</button>
                    {m.status !== 'active' && <span className="text-xs text-amber-600">{m.status}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{m.email || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{m.phone || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{m.classes || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{m.semester || <span className="text-gray-400">past only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && data && (
        <AddMemberModal leader={data.leader} onClose={() => setShowAdd(false)}
          onAdded={msg => { setShowAdd(false); setNotice(msg); loadMembers(); loadLeaders(); }} />
      )}
      {timelineFor && <StudentTimelineModal student={timelineFor} onClose={() => setTimelineFor(null)} />}
    </div>
  );
}
