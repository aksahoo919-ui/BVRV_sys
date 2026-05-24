import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TABS = ['Overview', 'Attendance', 'Marks', 'Counseling', 'Contacts', 'Leave History'];

function StatCard({ label, value, sub, color }) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <p className="text-red-500 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm text-emerald-600 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p>{message}</p>
    </div>
  );
}

function OverviewTab({ studentId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('Failed to load student overview.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const attColor =
    (data.attendance_pct || 0) >= 75 ? 'green' : (data.attendance_pct || 0) >= 60 ? 'amber' : 'red';
  const gpaColor =
    (data.latest_gpa || 0) >= 8 ? 'green' : (data.latest_gpa || 0) >= 6 ? 'amber' : 'red';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{data.name}</h2>
        <p className="text-sm text-gray-500">{data.email} · {data.roll_number}</p>
        {(data.department_name || data.course_name) && (
          <p className="text-sm text-gray-400 mt-0.5">
            {[data.department_name, data.course_name].filter(Boolean).join(' — ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Attendance"
          value={data.attendance_pct != null ? `${Number(data.attendance_pct).toFixed(1)}%` : '—'}
          color={attColor}
        />
        <StatCard
          label="Latest GPA"
          value={data.latest_gpa != null ? Number(data.latest_gpa).toFixed(1) : '—'}
          sub="out of 10"
          color={gpaColor}
        />
        <StatCard
          label="CGPA"
          value={data.cgpa != null ? Number(data.cgpa).toFixed(2) : '—'}
          sub="cumulative"
          color="blue"
        />
        <StatCard
          label="Rank"
          value={data.rank != null ? `#${data.rank}` : '—'}
          sub={data.total_students ? `of ${data.total_students}` : undefined}
          color="gray"
        />
      </div>

      {data.alert_reasons && data.alert_reasons.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">Active Alerts</p>
          <ul className="space-y-1">
            {data.alert_reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                <span className="mt-0.5">⚠</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ studentId, token }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/attendance`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error();
      setRows(await res.json());
    } catch {
      setError('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows.length) return <EmptyState message="No attendance records found." />;

  const totalAttended = rows.reduce((s, r) => s + (r.attended || 0), 0);
  const totalClasses = rows.reduce((s, r) => s + (r.total || 0), 0);
  const overallPct = totalClasses > 0 ? ((totalAttended / totalClasses) * 100).toFixed(1) : '—';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Attended</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">%</th>
            <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => {
            const pct = r.percentage != null ? Number(r.percentage) : (r.total ? (r.attended / r.total) * 100 : 0);
            const ok = pct >= 75;
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{r.subject_code}</td>
                <td className="py-3 pr-4 text-gray-900">{r.subject_name}</td>
                <td className="py-3 pr-4 text-right text-gray-700">{r.attended}</td>
                <td className="py-3 pr-4 text-right text-gray-700">{r.total}</td>
                <td className={`py-3 pr-4 text-right font-semibold ${ok ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                  {pct.toFixed(1)}%
                </td>
                <td className="py-3 text-center">
                  {ok
                    ? <span className="text-green-500 text-base">✓</span>
                    : <span className="text-amber-500 text-base">⚠</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td colSpan={2} className="py-3 pr-4 text-gray-700">Total</td>
            <td className="py-3 pr-4 text-right text-gray-700">{totalAttended}</td>
            <td className="py-3 pr-4 text-right text-gray-700">{totalClasses}</td>
            <td className={`py-3 pr-4 text-right font-bold ${Number(overallPct) >= 75 ? 'text-green-600' : 'text-red-500'}`}>
              {overallPct}{overallPct !== '—' ? '%' : ''}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MarksTab({ studentId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSemesters, setOpenSemesters] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/marks`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      // open first semester by default
      if (json.semesters && json.semesters.length > 0) {
        setOpenSemesters({ 0: true });
      }
    } catch {
      setError('Failed to load marks data.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !data.semesters || data.semesters.length === 0) return <EmptyState message="No marks records found." />;

  function toggle(idx) {
    setOpenSemesters((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="space-y-3">
      {data.semesters.map((sem, idx) => (
        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(idx)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="font-semibold text-gray-800">{sem.label}</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${openSemesters[idx] ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openSemesters[idx] && sem.subjects && sem.subjects.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-white text-left">
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Internal</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Exam</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">%</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sem.subjects.map((sub, j) => (
                    <tr key={j} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{sub.code}</td>
                      <td className="px-4 py-2 text-gray-900">{sub.name}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{sub.internal ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{sub.exam ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{sub.total_marks ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{sub.percentage != null ? `${Number(sub.percentage).toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-800">{sub.grade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {openSemesters[idx] && (!sem.subjects || sem.subjects.length === 0) && (
            <p className="px-4 py-3 text-sm text-gray-400">No subjects for this semester.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function CounselingTab({ studentId, token }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/counseling`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 404 || res.status === 500) {
        setNotes([]);
        return;
      }
      if (!res.ok) throw new Error();
      setNotes(await res.json());
    } catch {
      setError('Failed to load counseling notes.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/counseling`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      if (!res.ok) throw new Error();
      setNoteText('');
      await load();
    } catch {
      setSubmitError('Failed to add note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
        <p className="text-sm font-semibold text-gray-700">Add Counseling Note</p>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Write a counseling note…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        {submitError && <p className="text-xs text-red-500">{submitError}</p>}
        <button
          type="submit"
          disabled={submitting || !noteText.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Note'}
        </button>
      </form>

      {loading && <LoadingSpinner />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && notes.length === 0 && (
        <EmptyState message="No counseling notes yet." />
      )}
      {!loading && !error && notes.length > 0 && (
        <div className="space-y-3">
          {[...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((note) => (
            <div key={note.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{note.created_by_name}</span>
                <span className="text-xs text-gray-400">
                  {new Date(note.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsTab({ studentId, token }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/contacts`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 404 || res.status === 500) {
        setContacts([]);
        return;
      }
      if (!res.ok) throw new Error();
      setContacts(await res.json());
    } catch {
      setError('Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm({ name: '', relationship: '', phone: '', email: '' });
      setShowForm(false);
      await load();
    } catch {
      setSubmitError('Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await fetch(`/mentor/students/${studentId}/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      await load();
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'name', label: 'Name', placeholder: 'Full name' },
              { key: 'relationship', label: 'Relationship', placeholder: 'e.g. Father' },
              { key: 'phone', label: 'Phone', placeholder: '+91 9999999999' },
              { key: 'email', label: 'Email', placeholder: 'email@example.com' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          {submitError && <p className="text-xs text-red-500">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Saving…' : 'Save Contact'}
          </button>
        </form>
      )}

      {loading && <LoadingSpinner />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && contacts.length === 0 && <EmptyState message="No contacts added yet." />}
      {!loading && !error && contacts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                {['Name', 'Relationship', 'Phone', 'Email', ''].map((h) => (
                  <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{c.name}</td>
                  <td className="py-3 pr-4 text-gray-600">{c.relationship}</td>
                  <td className="py-3 pr-4 text-gray-600">{c.phone}</td>
                  <td className="py-3 pr-4 text-gray-600">{c.email}</td>
                  <td className="py-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deleting === c.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeaveHistoryTab({ studentId, token }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/mentor/students/${studentId}/leave-requests`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 404 || res.status === 500) {
        setRecords([]);
        return;
      }
      if (!res.ok) throw new Error();
      setRecords(await res.json());
    } catch {
      setError('Failed to load leave history.');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  function statusBadge(status) {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!records.length) return <EmptyState message="No leave requests found." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            {['From', 'To', 'Reason', 'Status', 'Reviewed At'].map((h) => (
              <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                {new Date(r.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </td>
              <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                {new Date(r.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </td>
              <td className="py-3 pr-4 text-gray-700 max-w-xs truncate">{r.reason}</td>
              <td className="py-3 pr-4">{statusBadge(r.status)}</td>
              <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                {r.reviewed_at
                  ? new Date(r.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MentorStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/mentor/students')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Students
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'Overview' && <OverviewTab studentId={studentId} token={token} />}
        {activeTab === 'Attendance' && <AttendanceTab studentId={studentId} token={token} />}
        {activeTab === 'Marks' && <MarksTab studentId={studentId} token={token} />}
        {activeTab === 'Counseling' && <CounselingTab studentId={studentId} token={token} />}
        {activeTab === 'Contacts' && <ContactsTab studentId={studentId} token={token} />}
        {activeTab === 'Leave History' && <LeaveHistoryTab studentId={studentId} token={token} />}
      </div>
    </div>
  );
}
