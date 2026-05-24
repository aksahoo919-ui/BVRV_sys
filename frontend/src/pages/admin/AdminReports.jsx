import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminReports() {
  const [tab, setTab] = useState('instructors');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/subjects').then(r => setSubjects(r.data));
  }, []);

  useEffect(() => {
    loadReport();
  }, [tab, selectedSubject]);

  async function loadReport() {
    if (tab === 'subject' && !selectedSubject) return;
    setLoading(true);
    try {
      let url = tab === 'instructors' ? '/admin/reports/instructors'
        : tab === 'students' ? '/admin/reports/students'
        : `/admin/reports/subject/${selectedSubject}`;
      const r = await api.get(url);
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    let url = tab === 'instructors' ? '/admin/reports/instructors?export=csv'
      : tab === 'students' ? '/admin/reports/students?export=csv'
      : `/admin/reports/subject/${selectedSubject}?export=csv`;
    window.open(`/api${url}`, '_blank');
  }

  const tabs = [
    { id: 'instructors', label: 'Instructors' },
    { id: 'students', label: 'Students' },
    { id: 'subject', label: 'Subject Detail' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <button onClick={exportCSV} disabled={tab === 'subject' && !selectedSubject} className="btn-secondary text-sm">Export CSV</button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subject' && (
        <div className="mb-4">
          <select className="input max-w-sm" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            <option value="">— Select a subject —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="card overflow-hidden p-0">
          {tab === 'instructors' && <InstructorsTable data={data} />}
          {tab === 'students' && <StudentsTable data={data} />}
          {tab === 'subject' && selectedSubject && <SubjectTable data={data} />}
        </div>
      )}
    </div>
  );
}

function InstructorsTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Instructor</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Subjects</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Sessions</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Last Session</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar user={r} />
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{r.subject_count} ({(r.subjects || []).join(', ')})</td>
              <td className="px-4 py-3 text-gray-600">{r.sessions_opened}</td>
              <td className="px-4 py-3 text-gray-400">{r.last_session_date ? new Date(r.last_session_date).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentsTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Student</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Subject</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Attended/Total</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">%</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-gray-50 ${r.below_threshold ? 'bg-amber-50' : ''}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar user={r} />
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{r.subject_code} — {r.subject_name}</td>
              <td className="px-4 py-3 text-gray-600">{r.attended}/{r.total_sessions}</td>
              <td className="px-4 py-3">
                <span className={`font-semibold ${r.below_threshold ? 'text-amber-600' : 'text-green-600'}`}>{r.percentage}%</span>
                {r.below_threshold && <span className="ml-1 text-amber-500">⚠</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Present</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Absent</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Flagged</th>
          <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{new Date(r.opened_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-green-600 font-medium">{r.present_count}</td>
              <td className="px-4 py-3 text-red-500 font-medium">{r.absent_count}</td>
              <td className="px-4 py-3 text-amber-500 font-medium">{r.flagged_count}</td>
              <td className="px-4 py-3"><span className={`badge ${r.closed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{r.closed ? 'Closed' : 'Open'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-7 h-7 rounded-full" alt="" />;
  return <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">{user.name?.[0]?.toUpperCase()}</div>;
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
