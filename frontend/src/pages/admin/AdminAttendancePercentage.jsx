import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { hasSemesters, semText } from '../../utils/classLabel';

// BVRV (class/subject) attendance % for every student, plus the upload for
// past attendance registers. BV Leader attendance is not part of this page.
export default function AdminAttendancePercentage() {
  const [tab, setTab] = useState('report');
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    api.get('/admin/subjects').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Attendance Summary</h1>
        <p className="text-sm text-gray-500 mt-0.5">BVRV class attendance for every student. Several sessions on one day count as one class; "Service" counts as present.</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[{ id: 'report', label: 'All Students' }, { id: 'import', label: 'Upload Past Attendance' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'report' ? <PercentageReport subjects={subjects} /> : <PastAttendanceImport subjects={subjects} />}
    </div>
  );
}

// ── All Students ─────────────────────────────────────────────────────────

const STATUS_LABEL = { ok: 'OK', low: 'Low', no_data: 'No sessions' };

function PercentageReport({ subjects }) {
  // semester: 'current' = each course's current semester, '' = all semesters, else a semester id
  const [filters, setFilters] = useState({ semester: 'current', course_id: '', subject_id: '', from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });

  const semesters = useMemo(() => uniqueBy(
    subjects.filter(s => hasSemesters(s)).map(s => ({ ...s, sem_label: `${s.course_name || '—'} · ${s.semester_label}${s.semester_is_current ? ' (current)' : ''}` })),
    'semester_id', 'sem_label'), [subjects]);
  const courses = useMemo(() => uniqueBy(subjects, 'course_id', 'course_name'), [subjects]);
  const classes = subjects.filter(s =>
    (filters.semester !== 'current' || s.semester_is_current) &&
    (!filters.semester || filters.semester === 'current' || s.semester_id === filters.semester) &&
    (!filters.course_id || s.course_id === filters.course_id));

  const { semester, ...rest } = filters;
  const params = Object.fromEntries(Object.entries({
    ...rest,
    current: semester === 'current' ? '1' : '',
    semester_id: semester && semester !== 'current' ? semester : '',
  }).filter(([, v]) => v));

  useEffect(() => {
    setLoading(true); setError('');
    api.get('/admin/reports/attendance-summary', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Could not load attendance'))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  function setFilter(k, v) {
    setFilters(f => {
      const next = { ...f, [k]: v };
      if (k !== 'subject_id' && k !== 'from' && k !== 'to') next.subject_id = '';
      return next;
    });
  }

  async function download(format) {
    try {
      const r = await api.get('/admin/reports/attendance-summary', { params: { ...params, export: format }, responseType: 'blob' });
      saveBlob(r.data, `attendance-percentage.${format}`);
    } catch { setError('Download failed'); }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows
      .filter(r => !status || r.status === status)
      .filter(r => !q || [r.name, r.email, r.phone, r.roll_number, r.classes].some(v => v && String(v).toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
      });
  }, [data, search, status, sort]);

  const s = data?.summary;

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 md:grid-cols-5 gap-3">
        <Select label="Semester" value={filters.semester} onChange={v => setFilter('semester', v)}
          options={[{ id: 'current', label: 'Current semesters' }, ...semesters]} allLabel="All semesters" />
        <Select label="Course" value={filters.course_id} onChange={v => setFilter('course_id', v)}
          options={courses} allLabel="All courses" />
        <Select label="Class" value={filters.subject_id} onChange={v => setFilter('subject_id', v)}
          options={classes.map(c => ({ id: c.id, label: `${c.code} — ${c.name}${semText(c) ? ` · ${semText(c)}` : ''}` }))} allLabel="All classes" />
        <label className="text-xs text-gray-500">From
          <input type="date" className="input mt-1" value={filters.from} onChange={e => setFilter('from', e.target.value)} />
        </label>
        <label className="text-xs text-gray-500">To
          <input type="date" className="input mt-1" value={filters.to} onChange={e => setFilter('to', e.target.value)} />
        </label>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Students" value={s.students} sub={`${s.with_data} with sessions`} />
          <Stat label="Average attendance" value={s.average_pct != null ? `${s.average_pct}%` : '—'} tone={tone(s.average_pct, s.threshold)} />
          <Stat label={`Below ${s.threshold}%`} value={s.below_threshold} tone={s.below_threshold ? 'amber' : 'green'}
            onClick={() => setStatus(status === 'low' ? '' : 'low')} active={status === 'low'} />
          <Stat label="No sessions yet" value={s.students - s.with_data} tone="gray"
            onClick={() => setStatus(status === 'no_data' ? '' : 'no_data')} active={status === 'no_data'} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search name, phone, email, class…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[11rem]" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ok">OK</option>
          <option value="low">Low</option>
          <option value="no_data">No sessions</option>
        </select>
        <span className="text-xs text-gray-500">{data ? `${rows.length} of ${data.rows.length}` : ''}</span>
        <div className="flex-1" />
        <button onClick={() => download('xlsx')} className="btn-secondary text-sm">Export Excel</button>
        <button onClick={() => download('csv')} className="btn-secondary text-sm">Export CSV</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && !data ? <Spinner /> : data && (
        <div className="card overflow-x-auto p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                <Th k="name" sort={sort} setSort={setSort}>Student</Th>
                <Th k="courses" sort={sort} setSort={setSort}>Course / Class</Th>
                <Th k="attended" sort={sort} setSort={setSort}>Attended</Th>
                <Th k="percentage" sort={sort} setSort={setSort} className="min-w-[180px]">Attendance %</Th>
                <Th k="status" sort={sort} setSort={setSort}>Status</Th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'low' ? 'bg-amber-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{[r.roll_number, r.phone, r.email].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{r.courses || '—'}</p>
                      <p className="text-xs text-gray-500">{r.classes || 'Not enrolled in a class'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.attended} / {r.total_sessions}</td>
                    <td className="px-4 py-3"><PctBar pct={r.percentage} threshold={s.threshold} /></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${r.status === 'ok' ? 'bg-green-100 text-green-700' : r.status === 'low' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No students match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upload Past Attendance ───────────────────────────────────────────────

function PastAttendanceImport({ subjects }) {
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState(null);
  const [dateOrder, setDateOrder] = useState('dmy');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [enroll, setEnroll] = useState(false);
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setPreview(null); setDone(null); setError(''); }, [subjectId, file, dateOrder, year, enroll]);

  async function send(dryRun) {
    if (!subjectId || !file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subject_id', subjectId);
    fd.append('date_order', dateOrder);
    fd.append('year', year);
    fd.append('enroll', enroll ? '1' : '0');
    setBusy(true); setError('');
    try {
      const r = await api.post(`/admin/attendance-import${dryRun ? '?dry_run=1' : ''}`, fd);
      if (dryRun) setPreview(r.data); else { setDone(r.data); setPreview(null); }
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed');
    } finally { setBusy(false); }
  }

  async function downloadTemplate() {
    try {
      const r = await api.get('/admin/attendance-import/template.csv', { params: { subject_id: subjectId }, responseType: 'blob' });
      const code = subjects.find(s => s.id === subjectId)?.code || 'class';
      saveBlob(r.data, `attendance_${code}.csv`);
    } catch { setError('Download failed'); }
  }

  const result = done || preview;

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-medium text-gray-800">How to upload</p>
          <ol className="list-decimal ml-5 space-y-0.5">
            <li>Pick the class. Upload one class register at a time.</li>
            <li>In Google Sheets: <b>File → Download → CSV</b> (or .xlsx). Use one tab per file.</li>
            <li>The sheet needs a <b>name</b>, <b>phone</b>, <b>email</b> or <b>roll number</b> column, and <b>one column per class date</b> (e.g. 06/07/2026 or 6-Jul).</li>
            <li>Cells: <b>P</b> = present, <b>A</b> = absent, <b>S</b> = service (✓ / 1 / Yes also mean present). Blank cells are left unchanged.</li>
            <li>Click <b>Check file</b> to preview. Nothing is saved until you click <b>Import</b>.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select label="Class" value={subjectId} onChange={setSubjectId}
            options={subjects.map(c => ({ id: c.id, label: `${c.code} — ${c.name}${semText(c) ? ` · ${semText(c)}` : ''}` }))}
            allLabel="— Select a class —" className="md:col-span-2" />
          <label className="text-xs text-gray-500">Dates in the sheet are
            <select className="input mt-1" value={dateOrder} onChange={e => setDateOrder(e.target.value)}>
              <option value="dmy">Day first (06/07 = 6 July)</option>
              <option value="mdy">Month first (07/06 = 6 July)</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">Year, if headers have none
            <input className="input mt-1" type="number" min="2000" max="2100" value={year} onChange={e => setYear(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,.xlsx" onChange={e => setFile(e.target.files[0] || null)} className="text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={enroll} onChange={e => setEnroll(e.target.checked)} />
            Also enrol students found in the portal but not in this class
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" disabled={!subjectId} onClick={downloadTemplate}>Download class register (CSV)</button>
          <div className="flex-1" />
          <button className="btn-secondary text-sm" disabled={!subjectId || !file || busy} onClick={() => send(true)}>
            {busy && !preview ? 'Checking…' : 'Check file'}
          </button>
          <button className="btn-primary text-sm" disabled={!preview || !preview.dates.length || busy} onClick={() => send(false)}>
            {busy && preview ? 'Importing…' : 'Import'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="card space-y-4">
          <div className={`rounded-lg px-4 py-3 text-sm ${done ? 'bg-green-50 text-green-800' : 'bg-shyama-50 text-shyama-800'}`}>
            {done
              ? <>Imported <b>{done.dates.length}</b> class dates for <b>{done.students_matched}</b> students into <b>{done.subject.code}</b>{done.to_enroll ? `, and enrolled ${done.to_enroll} students` : ''}.</>
              : <>Preview for <b>{preview.subject.code} — {preview.subject.name}</b>: {preview.students_matched} students matched out of {preview.rows_read} rows, {preview.dates.length} class dates.{preview.to_enroll ? ` ${preview.to_enroll} will be enrolled.` : ''} Nothing has been saved yet.</>}
          </div>

          {result.future_dates_skipped.length > 0 && (
            <p className="text-sm text-amber-700">Skipped future dates: {result.future_dates_skipped.join(', ')}. Check the date order setting if these look wrong.</p>
          )}

          {result.dates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  {['Date', 'Present', 'Service', 'Absent', 'Session'].map(h => <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.dates.map(d => (
                    <tr key={d.date}>
                      <td className="px-4 py-2 text-gray-800">{formatDate(d.date)}</td>
                      <td className="px-4 py-2 text-green-600 font-medium">{d.present}</td>
                      <td className="px-4 py-2 text-temple-700 font-medium">{d.service}</td>
                      <td className="px-4 py-2 text-red-500 font-medium">{d.absent}</td>
                      <td className="px-4 py-2 text-gray-500">{d.new_session ? 'New' : 'Updates existing'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.unmatched.length > 0 && (
            <Problems title={`Rows not imported (${result.unmatched.length})`}
              rows={result.unmatched.map(u => [`Row ${u.row}`, u.who || '—', u.reason])} />
          )}
          {result.bad_cells.length > 0 && (
            <Problems title={`Cells not understood (${result.bad_cells.length}), left unchanged`}
              rows={result.bad_cells.map(b => [`Row ${b.row}`, formatDate(b.date), `"${b.value}"`])} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────

function uniqueBy(list, idKey, labelKey) {
  const seen = new Map();
  for (const s of list) if (s[idKey] && !seen.has(s[idKey])) seen.set(s[idKey], { id: s[idKey], label: s[labelKey] || '—' });
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function tone(pct, threshold) {
  if (pct == null) return 'gray';
  return pct < threshold ? 'amber' : 'green';
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function formatDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Select({ label, value, onChange, options, allLabel, className = '' }) {
  return (
    <label className={`text-xs text-gray-500 ${className}`}>{label}
      <select className="input mt-1" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Stat({ label, value, sub, tone = 'gray', onClick, active }) {
  const colors = { green: 'text-green-600', amber: 'text-amber-600', gray: 'text-gray-900' };
  return (
    <div onClick={onClick} className={`card py-3 ${onClick ? 'cursor-pointer hover:border-primary-300' : ''} ${active ? 'ring-2 ring-primary-400' : ''}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${colors[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function PctBar({ pct, threshold }) {
  if (pct == null) return <span className="text-gray-500">—</span>;
  const low = pct < threshold;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${low ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`w-12 text-right font-semibold ${low ? 'text-amber-600' : 'text-green-600'}`}>{pct}%</span>
    </div>
  );
}

function Th({ k, sort, setSort, children, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={`text-left px-4 py-3 text-gray-500 font-medium ${className}`}>
      <button className="flex items-center gap-1 py-1 -my-1 min-h-[24px] hover:text-gray-800"
        onClick={() => setSort(active ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' || k === 'courses' ? 1 : -1 })}>
        {children}{active && <span>{sort.dir === 1 ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

function Problems({ title, rows }) {
  return (
    <details className="text-sm" open={rows.length <= 10}>
      <summary className="cursor-pointer font-medium text-amber-700">{title}</summary>
      <table className="w-full mt-2">
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5 text-gray-600">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
