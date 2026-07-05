import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function AdminSettings() {
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then(r => {
      setThreshold(r.data.attendance_threshold);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await api.patch('/admin/settings', { attendance_threshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="card max-w-md mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Attendance Threshold</h2>
        <p className="text-sm text-gray-500 mb-4">
          Students with attendance below this percentage will receive a warning indicator.
        </p>
        <div className="flex items-center gap-4 mb-6">
          <input
            type="number"
            min="0"
            max="100"
            className="input w-24"
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
          />
          <span className="text-gray-600 font-medium">%</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
        </div>
      </div>

      <ResetAttendanceCard />
    </div>
  );
}

function ResetAttendanceCard() {
  const [subjects, setSubjects] = useState([]);
  const [mode, setMode] = useState('class');     // 'class' | 'date' | 'all'
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);    // { deleted_sessions } | null
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/subjects')
      .then(r => setSubjects(
        [...r.data].sort((a, b) => (a.code || '').localeCompare(b.code || ''))
      ))
      .catch(() => {});
  }, []);

  function label(mode) {
    if (mode === 'class') {
      const s = subjects.find(x => String(x.id) === String(subjectId));
      return s ? `all attendance for ${s.code} — ${s.name}` : 'this class';
    }
    if (mode === 'date') return `all attendance recorded on ${date}`;
    return 'ALL class attendance for EVERY class and date';
  }

  async function handleReset() {
    setError(''); setResult(null);
    if (mode === 'class' && !subjectId) { setError('Please choose a class.'); return; }
    if (mode === 'date' && !date) { setError('Please choose a date.'); return; }

    const warn = `This will permanently delete ${label(mode)}.\n\nThis cannot be undone. Continue?`;
    if (!window.confirm(warn)) return;
    if (mode === 'all' && !window.confirm('Are you absolutely sure? This wipes EVERY class attendance record.')) return;

    const body = {};
    if (mode === 'class') body.subject_id = subjectId;
    if (mode === 'date') body.date = date;
    if (mode === 'all') body.confirm = 'RESET';

    setBusy(true);
    try {
      const r = await api.post('/admin/attendance/reset', body);
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-md border-red-200">
      <h2 className="font-semibold text-red-700 mb-1">Reset Attendance</h2>
      <p className="text-sm text-gray-500 mb-4">
        Permanently delete class attendance records. Use with care — this cannot be undone.
        BV Leader (weekly) attendance is not affected.
      </p>

      <div className="flex gap-2 mb-4">
        {[['class', 'Class-wise'], ['date', 'Date-wise'], ['all', 'Everything']].map(([val, txt]) => (
          <button
            key={val}
            onClick={() => { setMode(val); setResult(null); setError(''); }}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              mode === val
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>

      {mode === 'class' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Class (Subject)</label>
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— Select a class —</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}{s.academic_year_label ? ` (${s.academic_year_label})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'date' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Deletes every class's attendance recorded on this day.</p>
        </div>
      )}

      {mode === 'all' && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          ⚠ This deletes <strong>all class attendance for every class and date</strong>. There is no undo.
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {result && (
        <p className="text-sm text-green-600 mb-3 font-medium">
          ✓ Reset complete — {result.deleted_sessions} session{result.deleted_sessions === 1 ? '' : 's'} removed.
        </p>
      )}

      <button
        onClick={handleReset}
        disabled={busy}
        className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? 'Resetting…' : 'Reset Attendance'}
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
