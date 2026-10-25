import React, { useEffect, useState, useRef } from 'react';
import api from '../../utils/api';
import { semText } from '../../utils/classLabel';
import StudentTimelineModal from '../../components/StudentTimelineModal';

const STATUS_COLORS = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};
const ROLE_COLORS = {
  admin:   'bg-gold-100 text-gold-800',
  teacher: 'bg-shyama-100 text-shyama-800',
  mentor:  'bg-teal-100 text-teal-700',
  student: 'bg-green-100 text-green-700',
};
const ROLE_LABEL = { mentor: 'BV Leader', teacher: 'Teacher', student: 'Student', admin: 'Admin' };
const roleLabel = (r) => ROLE_LABEL[r] || r || '—';

// Change a student's classes: change (enrolment + BV leader move to the new class), add, or remove.
function CourseModal({ user, onClose, onChanged }) {
  const [classes, setClasses] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [pick, setPick] = useState({});      // from_subject_id -> new subject_id
  const [addId, setAddId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get(`/admin/users/${user.id}/classes`).then(r => setClasses(r.data)).catch(() => setError('Failed to load classes'));
    api.get('/admin/subjects').then(r => setSubjects([...r.data].filter(s => s.code !== 'TEST' && s.semester_is_current).sort((a, b) => a.code.localeCompare(b.code)))).catch(() => {});
  }, [user.id]);

  async function send(body, msg) {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api.post(`/admin/users/${user.id}/classes`, body);
      setClasses(r.data); setPick({}); setAddId(''); setNotice(msg); onChanged();
    } catch (err) { setError(err.response?.data?.error || 'Update failed'); }
    finally { setBusy(false); }
  }
  const mine = new Set((classes || []).map(c => c.subject_id));
  const label = id => subjects.find(s => s.id === id)?.code || '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Course: {user.name}</h2>
            <p className="text-xs text-gray-500">Changing a class moves the student and their BV leader to the new class. Past attendance stays with the old class. Only current-semester classes are offered; past semesters are on the Timeline.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600">✕</button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
        {!classes ? <p className="text-sm text-gray-500">Loading…</p> : (
          <div className="space-y-3">
            {classes.length === 0 && <p className="text-sm text-gray-500">Not in any class yet.</p>}
            {classes.map(c => (
              <div key={c.subject_id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{c.label}</p>
                    <p className="text-xs text-gray-500">BV Leader: {c.bv_leader || '—'} · {c.days_present} day{c.days_present === 1 ? '' : 's'} present</p>
                  </div>
                  <button disabled={busy} onClick={() => send({ from_subject_id: c.subject_id }, `Removed from ${c.code}.`)}
                    className="text-xs font-medium py-1 px-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50">Remove</button>
                </div>
                <div className="flex gap-2">
                  <select className="input text-sm" value={pick[c.subject_id] || ''} onChange={e => setPick(p => ({ ...p, [c.subject_id]: e.target.value }))}>
                    <option value="">Change to…</option>
                    {subjects.filter(s => !mine.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}{semText(s) ? ` · ${semText(s)}` : ''}</option>)}
                  </select>
                  <button disabled={busy || !pick[c.subject_id]} className="btn-primary text-sm whitespace-nowrap"
                    onClick={() => send({ from_subject_id: c.subject_id, to_subject_id: pick[c.subject_id] }, `Changed ${c.code} to ${label(pick[c.subject_id])}.`)}>
                    Change
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <select className="input text-sm" value={addId} onChange={e => setAddId(e.target.value)}>
                <option value="">Add another class…</option>
                {subjects.filter(s => !mine.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}{semText(s) ? ` · ${semText(s)}` : ''}</option>)}
              </select>
              <button disabled={busy || !addId} className="btn-secondary text-sm whitespace-nowrap"
                onClick={() => send({ to_subject_id: addId }, `Added ${label(addId)}.`)}>Add</button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]   = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterGender, setFilterGender] = useState(''); // '', 'Male', 'Female', 'none'
  const [search, setSearch]         = useState('');
  const [sort, setSort]             = useState({ key: null, dir: 'asc' }); // key null = API order (newest first)
  const [courseTarget, setCourseTarget] = useState(null); // student whose classes are being changed
  const [timelineTarget, setTimelineTarget] = useState(null); // student whose timeline is open

  // Participant import (course sheet)

  // Bulk delete by role
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkRole, setBulkRole] = useState('student');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  // Edit email
  // Edit user (email / phone / role)
  const [editTarget, setEditTarget] = useState(null); // user object
  const [editForm, setEditForm] = useState({ name: '', initiated_name: '', gender: '', email: '', phone: '', role: '', username: '', password: '' });
  const [editLeader, setEditLeader] = useState(null); // { original, value, mixed, leaders } for students
  const [leaderList, setLeaderList] = useState(null);  // BV Leaders for the Edit dropdown
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Add user
  const [showAdd, setShowAdd] = useState(false);
  const EMPTY_ADD = { name: '', role: 'student', gender: '', email: '', phone: '', subject_id: '', mentor_id: '' };
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [addOptions, setAddOptions] = useState(null); // { classes, leaders } for a new student's class + BV leader
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState('');

  // Dual role
  const [dualTarget, setDualTarget] = useState(null); // user object
  const [savingDual, setSavingDual] = useState(false);
  const [dualError, setDualError] = useState('');

  // Confirm-delete modal
  const [deleteTarget, setDeleteTarget] = useState(null); // user object
  const [deleting, setDeleting]         = useState(false);
  const [actionError, setActionError]   = useState('');
  const [loadError, setLoadError]       = useState('');

  const fileRef = useRef();

  async function load() {
    setLoadError('');
    try {
      const r = await api.get('/admin/users');
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Bulk import ──────────────────────────────────────────────────────────
  async function handleImport() {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post('/admin/users/bulk-import', form);
      setImportResult(r.data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv =
      'name,email,role,phone number,course name,language\n' +
      'John Doe,john@example.com,student,9876543210,Foundation 1,English\n' +
      'Ravi Kumar,ravi@example.com,student,9876511111,Bhakti Shastri 2,Telugu\n' +
      'Jane Smith,jane@example.com,teacher,9876500000,,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'import_template.csv'; a.click();
  }

  // ── Add user ───────────────────────────────────────────────────────────────
  function openAdd() {
    setShowAdd(true); setAddError('');
    if (!addOptions) {
      Promise.all([api.get('/admin/subjects'), api.get('/admin/mentors')])
        .then(([sr, mr]) => setAddOptions({
          classes: sr.data.filter(s => s.semester_is_current && s.code !== 'TEST').sort((a, b) => a.code.localeCompare(b.code)),
          leaders: mr.data,
        }))
        .catch(() => setAddOptions({ classes: [], leaders: [] }));
    }
  }

  async function handleAddUser() {
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    setAddingUser(true);
    setAddError('');
    if (addForm.role === 'student' && addForm.mentor_id && !addForm.subject_id) {
      setAddError('Pick the class too: a BV Leader is linked per class'); setAddingUser(false); return;
    }
    try {
      const r = await api.post('/admin/users', {
        name: addForm.name.trim(),
        role: addForm.role,
        gender: addForm.gender || null,
        email: addForm.email.trim() || null,
        phone: addForm.phone.trim() || null,
      });
      if (addForm.role === 'student' && addForm.subject_id) {
        if (addForm.mentor_id) {
          await api.post(`/admin/bv-members/${addForm.mentor_id}/members`, { subject_id: addForm.subject_id, student_id: r.data.id });
        } else {
          await api.post(`/admin/users/${r.data.id}/classes`, { to_subject_id: addForm.subject_id });
        }
      }
      setShowAdd(false);
      setAddForm(EMPTY_ADD);
      load();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  }

  async function resetPasswordToDefault() {
    if (!editTarget) return;
    if (!window.confirm(`Reset ${editTarget.name}'s password to the default (1896)?`)) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await api.patch(`/admin/users/${editTarget.id}/reset-password`);
      setEditForm(f => ({ ...f, password: '' }));
      setEditError('');
      alert('Password reset to default (1896).');
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Edit user (name / gender / email / phone / role / BV Leader) ───────────────────────────
  function openEdit(u) {
    setEditTarget(u);
    setEditForm({ name: u.name || '', initiated_name: u.initiated_name || '', gender: u.gender || '', email: u.email || '', phone: u.phone || '', role: u.role || 'student', username: u.username || '', password: '' });
    setEditError('');
    setEditLeader(null);
    if (u.role === 'student') {
      Promise.all([api.get(`/admin/users/${u.id}/bv-leader`), leaderList ? Promise.resolve(null) : api.get('/admin/mentors')])
        .then(([lr, mr]) => {
          if (mr) setLeaderList(mr.data);
          const original = lr.data.mentor_id || '';
          setEditLeader({ original: lr.data.mixed ? '__mixed' : original, value: lr.data.mixed ? '__mixed' : original, mixed: lr.data.mixed, leaders: lr.data.leaders });
        })
        .catch(() => setEditError('Could not load the BV Leader'));
    }
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const payload = {
        name: editForm.name.trim(),
        initiated_name: editForm.initiated_name.trim() || null,
        gender: editForm.gender || null,
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        username: editForm.username.trim(),
      };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await api.patch(`/admin/users/${editTarget.id}`, payload);
      if (editLeader && editLeader.value !== editLeader.original) {
        await api.put(`/admin/users/${editTarget.id}/bv-leader`, { mentor_id: editLeader.value || null });
      }
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Dual role ─────────────────────────────────────────────────────────────
  async function saveDual(secondary_role) {
    if (!dualTarget) return;
    setSavingDual(true);
    setDualError('');
    try {
      await api.patch(`/admin/users/${dualTarget.id}/secondary-role`, { secondary_role });
      setDualTarget(null);
      load();
    } catch (err) {
      setDualError(err.response?.data?.error || 'Failed to update');
    } finally {
      setSavingDual(false);
    }
  }

  // ── Bulk delete by role ────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setBulkDeleting(true);
    setBulkResult('');
    try {
      const r = await api.post('/admin/users/bulk-delete', { role: bulkRole });
      setBulkResult(`Deleted ${r.data.deleted} ${bulkRole}(s).`);
      load();
    } catch (err) {
      setBulkResult(err.response?.data?.error || 'Delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  // ── Suspend / Reactivate ─────────────────────────────────────────────────
  async function handleSuspend(user) {
    setActionError('');
    try {
      if (user.status === 'suspended') {
        await api.patch(`/admin/users/${user.id}/approve`);
      } else {
        await api.patch(`/admin/users/${user.id}/suspend`);
      }
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action failed');
    }
  }

  // ── Permanent delete ─────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  const visible = users.filter(u => {
    if (filterRole && u.role !== filterRole && u.secondary_role !== filterRole) return false;
    if (filterGender && (filterGender === 'none' ? !!u.gender : u.gender !== filterGender)) return false;
    if (search) {
      const q = search.toLowerCase();
      // phone: digits only and without a leading 91/0, so "90104 43360" and "+91 90104 43360" both find 9010443360
      const tenDigits = d => { d = String(d || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d; };
      const qDigits = tenDigits(q);
      const phoneHit = qDigits.length >= 3 && tenDigits(u.phone).includes(qDigits);
      return u.name?.toLowerCase().includes(q) || u.initiated_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || phoneHit
        || u.bv_leader?.toLowerCase().includes(q) || u.course?.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Sorting (after filtering; empty values always last) ──────────────────
  const sortValue = (u, key) => {
    if (key === 'created_at') return u.created_at ? new Date(u.created_at).getTime() : null;
    if (key === 'role') return u.role ? roleLabel(u.role) : null;
    if (key === 'bv_leader') return u.role === 'student' ? (u.bv_leader || null) : null;
    if (key === 'course') return u.course || null;
    return u[key] || null;
  };
  const rows = !sort.key ? visible : [...visible].sort((a, b) => {
    const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
    return sort.dir === 'asc' ? c : -c;
  });
  const toggleSort = (key) => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  // BV Leaders / teachers / admins have no BV Leader: hide that column when one of those roles is selected.
  // The Course column then shows the language (BV Leaders) or the courses taught (teachers).
  const showLeaderCol = !['mentor', 'teacher', 'admin'].includes(filterRole);
  const courseColLabel = filterRole === 'mentor' ? 'Language' : filterRole === 'teacher' ? 'Courses taught' : 'Course';

  function SortTh({ k, label, className = '' }) {
    const active = sort.key === k;
    return (
      <th className={`text-left px-4 py-3 font-medium text-gray-500 ${className}`}>
        <button type="button" onClick={() => toggleSort(k)} aria-label={`Sort by ${label}`} className="inline-flex items-center gap-1 py-1 -my-1 min-h-[24px] hover:text-gray-800">
          {label}
          <span className={`text-[10px] ${active ? 'text-gray-700' : 'text-gray-500'}`}>
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">All Users</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openAdd} className="btn-primary text-sm">+ Add User</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">Bulk Import</button>
          <button onClick={() => { setShowBulkDelete(true); setBulkResult(''); }} className="text-sm font-semibold py-2 px-4 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors">Bulk Delete</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input text-sm max-w-xs"
          placeholder="Search name, initiated name, email, phone or BV Leader…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input text-sm w-auto"
          aria-label="Filter by role"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="mentor">BV Leaders</option>
          <option value="admin">Admins</option>
        </select>
        <select className="input text-sm w-auto" aria-label="Filter by gender" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="">All genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="none">Gender not set</option>
        </select>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {loadError}
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-700 mb-3">{actionError}</p>
      )}

      {/* Bulk import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Bulk Import Users</h2>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">CSV columns: <code className="bg-gray-100 px-1 rounded">name, email, role, phone number, course name, language</code></p>
            <p className="text-xs text-gray-500 mb-3">Only name &amp; role are required — email, phone, course name &amp; language are optional. Rows without an email still import (a placeholder is generated). If a student row has course + language, they're auto-enrolled into that subject. Two rows with the same email as teacher and BV Leader automatically get a dual role.</p>
            <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline mb-3 block inline-flex items-center min-h-[24px]">Download template CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="input mb-3" />
            {importResult && (
              <div className={`text-sm mb-3 p-3 rounded-lg ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importResult.error || `Imported: ${importResult.imported}${importResult.enrolled != null ? ` | Enrolled: ${importResult.enrolled}` : ''} | Skipped: ${importResult.skipped?.length || 0}`}
                {importResult.skipped?.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 max-h-40 overflow-y-auto list-disc list-inside">
                    {importResult.skipped.map((s, i) => (
                      <li key={i}>Row {s.row}{s.email ? ` (${s.email})` : ''}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleImport} disabled={importing} className="btn-primary flex-1">{importing ? 'Importing…' : 'Import'}</button>
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">⚠</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Bulk delete users</h2>
                <p className="text-sm text-gray-500">Permanently removes ALL users of a role.</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role to delete</label>
            <select className="input mb-3" value={bulkRole} onChange={e => setBulkRole(e.target.value)}>
              <option value="student">All Students</option>
              <option value="mentor">All BV Leaders</option>
              <option value="teacher">All Teachers</option>
            </select>
            <p className="text-xs text-red-600 mb-3">This cannot be undone. Admins are never affected.</p>
            {bulkResult && <p className="text-sm mb-3 text-gray-700">{bulkResult}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : `Delete all ${bulkRole}s`}
              </button>
              <button onClick={() => setShowBulkDelete(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Add User</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input mb-3" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select className="input mb-3" value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="mentor">BV Leader</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select className="input mb-3" value={addForm.gender} onChange={e => setAddForm(f => ({ ...f, gender: e.target.value }))}>
              <option value="">— Not set —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-500 font-normal">(optional)</span></label>
            <input type="email" className="input mb-3" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-500 font-normal">(optional)</span></label>
            <input className="input mb-3" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            {addForm.role === 'student' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-gray-500 font-normal">(optional, current semester)</span></label>
                <select className="input mb-3" value={addForm.subject_id} onChange={e => setAddForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">— No class yet —</option>
                  {(addOptions?.classes || []).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}{semText(c) ? ` · ${semText(c)}` : ''}</option>)}
                </select>
                <label className="block text-sm font-medium text-gray-700 mb-1">BV Leader <span className="text-gray-500 font-normal">(optional)</span></label>
                <select className="input mb-3" value={addForm.mentor_id} onChange={e => setAddForm(f => ({ ...f, mentor_id: e.target.value }))}>
                  <option value="">— No BV Leader —</option>
                  {(addOptions?.leaders || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </>
            )}
            {addError && <p className="text-sm text-red-700 mb-3">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddUser} disabled={addingUser || !addForm.name.trim()} className="btn-primary flex-1">
                {addingUser ? 'Adding…' : 'Add User'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Edit user</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input className="input mb-3" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Initiated name <span className="text-gray-500 font-normal">(if initiated)</span></label>
            <input className="input mb-3" value={editForm.initiated_name} onChange={e => setEditForm(f => ({ ...f, initiated_name: e.target.value }))} placeholder="e.g. Amiyalila Gaura Das" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select className="input mb-3" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
              <option value="">— Not set —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className="input mb-3" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} placeholder="username" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="text" className="input mb-1" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep unchanged" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">Default password is <code className="bg-gray-100 px-1 rounded">1896</code>.</p>
              <button type="button" onClick={resetPasswordToDefault} disabled={savingEdit} className="text-xs font-medium text-amber-700 hover:underline inline-flex items-center min-h-[24px]">Reset to 1896</button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input mb-3" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input mb-3" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input mb-3" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="mentor">BV Leader</option>
            </select>
            {editTarget.role === 'student' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">BV Leader</label>
                {!editLeader ? <p className="text-sm text-gray-500 mb-3">Loading…</p> : (
                  <>
                    <select className="input mb-1" value={editLeader.value} onChange={e => setEditLeader(l => ({ ...l, value: e.target.value }))}>
                      {editLeader.mixed && <option value="__mixed">Different per course: {editLeader.leaders.map(l => l.name).join(' / ')}</option>}
                      <option value="">— No BV Leader —</option>
                      {(leaderList || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mb-3">Applies to all of the student's current-semester courses.</p>
                  </>
                )}
              </>
            )}
            <p className="text-xs text-gray-500 mb-3">A real email lets this person sign in with Google.</p>
            {editError && <p className="text-sm text-red-700 mb-3">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit || !editForm.email.trim() || !editForm.name.trim()} className="btn-primary flex-1">
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Dual role modal */}
      {dualTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Dual role assignment</h2>
              <button onClick={() => setDualTarget(null)} className="text-gray-500 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">{dualTarget.name}</p>
            <p className="text-xs text-gray-500 mb-4">
              Primary role: <span className="font-medium text-gray-700">{roleLabel(dualTarget.role)}</span>
              {dualTarget.secondary_role && (
                <> · Current secondary: <span className="font-medium text-gray-700">{roleLabel(dualTarget.secondary_role)}</span></>
              )}
            </p>
            {dualError && <p className="text-sm text-red-700 mb-3">{dualError}</p>}
            <div className="space-y-2">
              {dualTarget.role === 'teacher' && (
                <button
                  onClick={() => saveDual('mentor')}
                  disabled={savingDual || dualTarget.secondary_role === 'mentor'}
                  className="w-full text-left px-4 py-3 rounded-lg border border-temple-200 hover:bg-temple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span className="font-medium text-temple-800">Add BV Leader role</span>
                  <p className="text-xs text-gray-500 mt-0.5">User will see both Teacher and BV Leader dashboards.</p>
                </button>
              )}
              {dualTarget.role === 'mentor' && (
                <button
                  onClick={() => saveDual('teacher')}
                  disabled={savingDual || dualTarget.secondary_role === 'teacher'}
                  className="w-full text-left px-4 py-3 rounded-lg border border-shyama-200 hover:bg-shyama-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span className="font-medium text-temple-800">Add Teacher role</span>
                  <p className="text-xs text-gray-500 mt-0.5">User will see both Teacher and BV Leader dashboards.</p>
                </button>
              )}
              {dualTarget.secondary_role && (
                <button
                  onClick={() => saveDual(null)}
                  disabled={savingDual}
                  className="w-full text-left px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
                >
                  <span className="font-medium text-red-700">Remove secondary role</span>
                  <p className="text-xs text-gray-500 mt-0.5">User will only access their primary role.</p>
                </button>
              )}
            </div>
            <button onClick={() => setDualTarget(null)} className="btn-secondary w-full mt-3">Close</button>
          </div>
        </div>
      )}

      {courseTarget && <CourseModal user={courseTarget} onClose={() => setCourseTarget(null)} onChanged={load} />}
      {timelineTarget && <StudentTimelineModal student={timelineTarget} onClose={() => setTimelineTarget(null)} />}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-700 text-lg">⚠</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Remove user permanently?</h2>
                <p className="text-sm text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium text-gray-800">{deleteTarget.name}</p>
              <p className="text-gray-500">{deleteTarget.email}</p>
              <p className="text-gray-500 capitalize">{deleteTarget.role}</p>
            </div>
            {actionError && <p className="text-sm text-red-700 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting ? 'Removing…' : 'Yes, remove'}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setActionError(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortTh k="name" label="User" />
                  <SortTh k="initiated_name" label="Initiated name" />
                  {showLeaderCol && <SortTh k="bv_leader" label="BV Leader" />}
                  <SortTh k="course" label={courseColLabel} />
                  <SortTh k="gender" label="Gender" />
                  <SortTh k="role" label="Role" />
                  <SortTh k="status" label="Status" />
                  <SortTh k="created_at" label="Joined" className="hidden md:table-cell" />
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr><td colSpan={showLeaderCol ? 9 : 8} className="text-center py-10 text-gray-500">No users found.</td></tr>
                )}
                {rows.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.initiated_name || <span className="text-gray-500">—</span>}</td>
                    {showLeaderCol && <td className="px-4 py-3">
                      {u.role === 'student' && (u.bv_leader
                        ? <span className="font-medium text-teal-700">{u.bv_leader}</span>
                        : <span className="text-gray-500">—</span>)}
                    </td>}
                    <td className="px-4 py-3 text-gray-600">
                      {u.course || <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.gender || <span className="text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`badge ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>{roleLabel(u.role)}</span>
                        {u.secondary_role && (
                          <span className={`badge ${ROLE_COLORS[u.secondary_role] || 'bg-gray-100 text-gray-600'} opacity-70`}>+{roleLabel(u.secondary_role)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-600'}`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-gray-500">—</span>
                      ) : (
                        <div className="flex gap-1.5 justify-end">
                          {/* Edit user */}
                          <button
                            onClick={() => openEdit(u)}
                            className="text-xs font-medium py-1 px-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          {/* Course — students only */}
                          {u.role === 'student' && (
                            <button
                              onClick={() => setCourseTarget(u)}
                              className="text-xs font-medium py-1 px-2 rounded-md border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors"
                            >
                              Course
                            </button>
                          )}
                          {u.role === 'student' && (
                            <button
                              onClick={() => setTimelineTarget(u)}
                              className="text-xs font-medium py-1 px-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Timeline
                            </button>
                          )}
                          {/* Dual role — only for teacher/mentor */}
                          {(u.role === 'teacher' || u.role === 'mentor') && (
                            <button
                              onClick={() => { setDualTarget(u); setDualError(''); }}
                              className={`text-xs font-medium py-1 px-2 rounded-md border transition-colors ${
                                u.secondary_role
                                  ? 'border-teal-300 text-teal-700 hover:bg-teal-50'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              Dual
                            </button>
                          )}
                          {/* Suspend / Reactivate */}
                          <button
                            onClick={() => handleSuspend(u)}
                            className={`text-xs font-medium py-1 px-2 rounded-md border transition-colors ${
                              u.status === 'suspended'
                                ? 'border-green-300 text-green-700 hover:bg-green-50'
                                : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => { setDeleteTarget(u); setActionError(''); }}
                            className="text-xs font-medium py-1 px-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
            {visible.length} of {users.length} users
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }) {
  if (user.avatar_url) return <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt="" />;
  return (
    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
