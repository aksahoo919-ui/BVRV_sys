import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const csvCell = v => {
  const t = v == null ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export default function AdminBVMembers() {
  const [leaders, setLeaders] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/bv-members/leaders')
      .then(r => setLeaders(r.data))
      .catch(() => setError('Failed to load BV Leaders'));
  }, []);

  useEffect(() => {
    if (!leaderId) { setData(null); return; }
    setLoading(true); setError(''); setSearch('');
    api.get(`/admin/bv-members/${leaderId}`)
      .then(r => setData(r.data))
      .catch(e => { setData(null); setError(e.response?.data?.error || 'Failed to load members'); })
      .finally(() => setLoading(false));
  }, [leaderId]);

  const members = data?.members || [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      [m.name, m.email, m.phone, m.roll_number, m.classes].some(v => String(v || '').toLowerCase().includes(q)));
  }, [members, search]);

  function exportCsv() {
    const rows = [['Name', 'Email', 'Phone', 'Roll No', 'Current BVRV Class'],
      ...shown.map(m => [m.name, m.email, m.phone, m.roll_number, m.classes])];
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
        <p className="text-sm text-gray-400 mt-0.5">Pick a BV Leader to see the students assigned to them. Assignments are made on the Class BV Leaders page.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

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
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">BV Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Current BVRV Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                  {data.count === 0 ? 'No members are assigned to this BV Leader yet.' : 'No members match your search.'}
                </td></tr>
              ) : shown.map((m, i) => (
                <tr key={m.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    {m.status !== 'active' && <span className="text-xs text-amber-600">{m.status}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{m.email || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{m.phone || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{m.classes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
