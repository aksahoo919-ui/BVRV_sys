import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    if (tab === 'quality') return;
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
    { id: 'quality', label: 'Data quality' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        {tab !== 'quality' && (
          <button onClick={exportCSV} disabled={tab === 'subject' && !selectedSubject} className="btn-secondary text-sm">Export CSV</button>
        )}
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

      {tab === 'quality' ? <DataQualityPanel /> : loading ? <Spinner /> : (
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
  const { rows, Th } = useSort(data, { key: 'name', dir: 'asc' }, {
    name: r => r.name, subjects: r => Number(r.subject_count), sessions: r => Number(r.sessions_opened), last: r => r.last_session_date,
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <Th k="name" label="Instructor" />
          <Th k="subjects" label="Subjects" />
          <Th k="sessions" label="Sessions" />
          <Th k="last" label="Last Session" />
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
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
  const { rows, Th } = useSort(data, { key: 'name', dir: 'asc' }, {
    name: r => r.name, subject: r => r.subject_code, attended: r => Number(r.attended), pct: r => Number(r.percentage),
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <Th k="name" label="Student" />
          <Th k="subject" label="Subject" />
          <Th k="attended" label="Attended/Total" />
          <Th k="pct" label="%" />
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
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
  const { rows, Th } = useSort(data, { key: 'date', dir: 'desc' }, {
    date: r => r.opened_at, present: r => Number(r.present_count), absent: r => Number(r.absent_count),
    flagged: r => Number(r.flagged_count), status: r => (r.closed ? 'Closed' : 'Open'),
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>
          <Th k="date" label="Date" />
          <Th k="present" label="Present" />
          <Th k="absent" label="Absent" />
          <Th k="flagged" label="Flagged" />
          <Th k="status" label="Status" />
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
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

function DataQualityPanel() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [section, setSection] = useState('email');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  // duplicates read best grouped: sort by the Duplicate column there
  useEffect(() => { setSort({ key: DUP_TYPE[section] ? 'problem' : null, dir: 'asc' }); }, [section]);

  useEffect(() => {
    api.get('/admin/reports/data-quality')
      .then(r => setReport(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load report'));
  }, []);

  async function downloadExcel() {
    setDownloading(true); setError('');
    try {
      const r = await api.get('/admin/reports/data-quality?export=xlsx', { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'bvrv-data-quality.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Download failed'); }
    finally { setDownloading(false); }
  }

  if (error && !report) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>;
  if (!report) return <Spinner />;

  const s = report.summary;
  // duplicate cards always show their number, 0 included
  const dupGroups = type => report.shared.filter(g => g.type === type);
  const dupCard = (id, type, label) => {
    const groups = dupGroups(type);
    const users = groups.reduce((n, g) => n + g.count, 0);
    return { id, label, value: groups.length, sub: groups.length ? `${groups.length} group${groups.length === 1 ? '' : 's'} · ${users} users` : 'None found' };
  };
  const cards = [
    { id: 'email', label: 'Email missing / invalid', value: s.email_issues },
    { id: 'phone', label: 'Phone missing / invalid', value: s.phone_issues },
    dupCard('dup_email', 'Email', 'Duplicate emails'),
    dupCard('dup_phone', 'Phone', 'Duplicate phones'),
    dupCard('dup_name', 'Name', 'Duplicate names'),
    { id: 'dup_course', label: 'Duplicate courses', value: s.dup_course_students ?? 0, sub: s.dup_course_students ? 'students in 2+ courses' : 'None found' },
    { id: 'noleader', label: 'No BV Leader', value: s.no_bv_leader },
  ];
  const isDup = !!DUP_TYPE[section];
  const all = isDup
    ? dupGroups(DUP_TYPE[section])
        .flatMap(g => g.users.map(u => ({ ...u, problem: `${g.value} (${g.count} users)${g.note ? ` · ${g.note}` : ''}` })))
    : (section === 'email' ? report.email_issues : section === 'phone' ? report.phone_issues : section === 'dup_course' ? (report.dup_courses || []) : report.no_bv_leader);
  const emptyText = isDup ? `No duplicate ${DUP_TYPE[section].toLowerCase()}s: 0 found.` : section === 'dup_course' ? 'No student is in more than one course: 0 found.' : 'Nothing to fix here: 0 found.';
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter(u => [u.name, u.email, u.phone, u.problem, u.bv_leader, u.course].some(v => v && String(v).toLowerCase().includes(q)))
    : all;
  const rows = sortRows(filtered, sort, QUALITY_SORT);
  const Th = ({ k, label }) => <SortHeader k={k} label={label} sort={sort} onSort={setSort} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          {s.active_students} active students checked. Valid phone = 10 digits starting 6–9; valid email = name@domain.
        </p>
        <button onClick={downloadExcel} disabled={downloading} className="btn-primary text-sm">
          {downloading ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map(c => (
          <button key={c.id} onClick={() => setSection(c.id)}
            className={`card text-left ${section === c.id ? 'ring-2 ring-primary-400' : ''}`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.value ? 'text-amber-600' : 'text-gray-900'}`}>{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400">{c.sub}</p>}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-gray-400">
            {cards.find(c => c.id === section)?.label}: {q ? `${rows.length} of ${all.length}` : `${all.length}`} {isDup ? 'users in duplicate groups' : 'rows'}
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone, BV leader, course"
            className="input text-sm w-72 max-w-full" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b sticky top-0 z-10"><tr>
            <Th k="name" label="Devotee" />
            <Th k="email" label="Email" />
            <Th k="phone" label="Phone" />
            {section !== 'noleader' && <Th k="problem" label={isDup ? `Same ${DUP_TYPE[section].toLowerCase()}` : section === 'dup_course' ? 'Courses' : 'Problem'} />}
            {section !== 'noleader' && <Th k="bv_leader" label="BV Leader" />}
            <Th k="course" label="Current Course" />
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">{q ? 'No matches.' : emptyText}</td></tr>
            ) : rows.map((u, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}{isDup && u.role !== 'student' ? <span className="ml-1 text-xs text-gray-400">({u.role})</span> : null}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.email || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.phone || '—'}</td>
                {section !== 'noleader' && <td className="px-4 py-2.5 text-amber-700 text-xs">{u.problem}</td>}
                {section !== 'noleader' && <td className="px-4 py-2.5 text-gray-600">{u.bv_leader || '—'}</td>}
                <td className="px-4 py-2.5 text-gray-600">{u.course || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

const DUP_TYPE = { dup_email: 'Email', dup_phone: 'Phone', dup_name: 'Name' };

// ── Column sorting (click a header: ascending, again: descending) ──────────
const QUALITY_SORT = {
  name: u => u.name, email: u => u.email, phone: u => u.phone, problem: u => u.problem,
  bv_leader: u => u.bv_leader, course: u => u.course,
};

// Empty values always go last; numbers compare as numbers, text A–Z ignoring case.
function sortRows(rows, sort, getters) {
  const get = getters[sort.key];
  if (!get) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    const xe = x == null || x === '' || Number.isNaN(x), ye = y == null || y === '' || Number.isNaN(y);
    if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), 'en', { sensitivity: 'base', numeric: true }) * dir;
  });
}

function SortHeader({ k, label, sort, onSort }) {
  const active = sort.key === k;
  return (
    <th className="text-left px-4 py-3 text-gray-500 font-medium">
      <button type="button" onClick={() => onSort(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
        className="inline-flex items-center gap-1 hover:text-gray-800">
        {label}
        <span className={`text-[10px] ${active ? 'text-gray-700' : 'text-gray-300'}`}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function useSort(data, initial, getters) {
  const [sort, setSort] = useState(initial);
  const rows = useMemo(() => sortRows(data || [], sort, getters), [data, sort]); // getters are static per table
  const Th = useCallback(({ k, label }) => <SortHeader k={k} label={label} sort={sort} onSort={setSort} />, [sort]);
  return { rows, Th };
}

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-7 h-7 rounded-full" alt="" />;
  return <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">{user.name?.[0]?.toUpperCase()}</div>;
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
