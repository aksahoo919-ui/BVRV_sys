import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { className, classLabel } from '../../utils/classLabel';

// Mentors > BVRV Mentors (kind="bvrv": Course ID) and BV Mentors (kind="bv": Language).
// Mentor and coordinator are picked from portal users or typed in.

const LANGUAGES = ['English', 'Hindi', 'Telugu'];
const TITLES = {
  bvrv: { title: 'BVRV Mentors', first: { key: 'course_code', label: 'Course' }, hint: 'Mentor for each BVRV class (e.g. Bhakti Shastri 1 - English). One row per mentor of each class; remove a row if that devotee is not the mentor of that class.' },
  bv:   { title: 'BV Mentors',   first: { key: 'language',    label: 'Language' },  hint: 'BV mentors by language, with their coordinator.' },
};

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const csvCell = v => {
  const t = v == null ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const personLabel = u => [u.name, u.phone, u.email].filter(Boolean).join(' · ');

// Text box with suggestions from portal users. Picking a suggestion links the account;
// anything else typed is kept as a plain name.
function PersonPicker({ people, userId, onPick, placeholder, listId }) {
  const picked = people.find(p => p.id === userId);
  const [text, setText] = useState(picked ? personLabel(picked) : '');
  useEffect(() => { if (picked) setText(personLabel(picked)); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  function change(v) {
    setText(v);
    const hit = people.find(p => personLabel(p) === v);
    onPick(hit || null, v);
  }
  return (
    <>
      <input className="input" list={listId} value={text} placeholder={placeholder} onChange={e => change(e.target.value)} />
      <datalist id={listId}>
        {people.map(p => <option key={p.id} value={personLabel(p)} />)}
      </datalist>
      <p className="text-xs mt-1 text-gray-400">
        {userId ? <span className="text-teal-700">Linked to portal account</span> : 'Not linked: type the name below, or pick from the list'}
      </p>
    </>
  );
}

function MentorForm({ kind, row, people, subjects, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    user_id: row?.user_id || '', name: row?.name || '', phone: row?.phone || '', email: row?.email || '',
    subject_id: row?.subject_id || '', language: row?.language || '',
    coordinator_user_id: row?.coordinator_user_id || '', coordinator_name: row?.coordinator_name || '', coordinator_phone: row?.coordinator_phone || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  function pickMentor(u, typed) {
    if (u) setF(s => ({ ...s, user_id: u.id, name: u.name || '', phone: u.phone || '', email: u.email || '' }));
    else setF(s => ({ ...s, user_id: '', name: typed }));
  }
  function pickCoordinator(u, typed) {
    if (u) setF(s => ({ ...s, coordinator_user_id: u.id, coordinator_name: u.name || '', coordinator_phone: u.phone || '' }));
    else setF(s => ({ ...s, coordinator_user_id: '', coordinator_name: typed }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...f, kind };
      const r = row ? await api.patch(`/admin/mentor-directory/${row.id}`, body) : await api.post('/admin/mentor-directory', body);
      onSaved(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={save} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{row ? 'Edit' : 'Add'} {TITLES[kind].title.replace(/s$/, '')}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        {kind === 'bvrv' ? (
          <label className="block text-sm">
            <span className="text-gray-600">Course</span>
            <select className="input mt-1" value={f.subject_id} onChange={e => set('subject_id', e.target.value)} required>
              <option value="">— Select a course —</option>
              {subjects.filter(s => s.semester_is_current || s.id === f.subject_id).map(s => <option key={s.id} value={s.id}>{classLabel(s)}</option>)}
            </select>
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-gray-600">Language</span>
            <select className="input mt-1" value={f.language} onChange={e => set('language', e.target.value)}>
              <option value="">— Not set —</option>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-800">Mentor</legend>
          <PersonPicker people={people} userId={f.user_id} onPick={pickMentor} listId="mentor-people" placeholder="Search a user by name / phone / email" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className="input" placeholder="Name" value={f.name} onChange={e => set('name', e.target.value)} />
            <input className="input" placeholder="Phone" value={f.phone} onChange={e => set('phone', e.target.value)} />
            <input className="input" placeholder="Email" value={f.email} onChange={e => set('email', e.target.value)} />
          </div>
          {f.user_id && <p className="text-xs text-gray-400">Changing these here only changes this list, not the user's login.</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-800">Coordinator</legend>
          <PersonPicker people={people} userId={f.coordinator_user_id} onPick={pickCoordinator} listId="coord-people" placeholder="Search a user, or type a name" />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Coordinator name" value={f.coordinator_name} onChange={e => set('coordinator_name', e.target.value)} />
            <input className="input" placeholder="Coordinator mobile" value={f.coordinator_phone} onChange={e => set('coordinator_phone', e.target.value)} />
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function CoordinatorBulk({ count, people, onClose, onApply }) {
  const [c, setC] = useState({ coordinator_user_id: '', coordinator_name: '', coordinator_phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function pick(u, typed) {
    if (u) setC({ coordinator_user_id: u.id, coordinator_name: u.name || '', coordinator_phone: u.phone || '' });
    else setC(s => ({ ...s, coordinator_user_id: '', coordinator_name: typed }));
  }
  async function apply() {
    setSaving(true); setError('');
    try { await onApply(c); } catch (err) { setError(err.response?.data?.error || 'Update failed'); setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Set coordinator for {count} mentor{count === 1 ? '' : 's'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <PersonPicker people={people} userId={c.coordinator_user_id} onPick={pick} listId="bulk-coord-people" placeholder="Search a user, or type a name" />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Coordinator name" value={c.coordinator_name} onChange={e => setC(s => ({ ...s, coordinator_name: e.target.value }))} />
          <input className="input" placeholder="Coordinator mobile" value={c.coordinator_phone} onChange={e => setC(s => ({ ...s, coordinator_phone: e.target.value }))} />
        </div>
        <p className="text-xs text-gray-400">Leave both empty and apply to clear the coordinator.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="button" onClick={apply} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Apply'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMentors({ kind }) {
  const meta = TITLES[kind];
  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);      // row, or {} for a new one
  const [bulk, setBulk] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    return api.get('/admin/mentor-directory', { params: { kind } })
      .then(r => setRows(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load mentors'));
  }
  useEffect(() => {
    setRows(null); setSelected(new Set()); setSearch(''); setSort({ key: null, dir: 'asc' }); setError(''); setNotice('');
    load();
    api.get('/admin/mentor-directory/options').then(r => setPeople(r.data)).catch(() => {});
    if (kind === 'bvrv') api.get('/admin/subjects').then(r => setSubjects([...r.data].filter(s => s.code !== 'TEST').sort((a, b) => a.code.localeCompare(b.code)))).catch(() => {});
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const coordText = r => [r.coordinator_name, r.coordinator_phone].filter(Boolean).join(' · ');
  const cols = [meta.first, ...(kind === 'bvrv' ? [{ key: 'semester_label', label: 'Semester' }] : []),
    { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone Number' },
    { key: 'email', label: 'Email ID' }, { key: 'coordinator', label: 'Coordinator (Name & Mobile)' }];
  const val = (r, k) => (k === 'coordinator' ? coordText(r) : r[k]) || null;
  const semText = r => (r.semester_id ? `${r.semester_label}${r.semester_is_current ? '' : ' (past)'}` : '');

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (rows || []).filter(r => !q || [r.course_code, r.course_name, className(r.course_name), r.semester_label, r.language, r.name, r.phone, r.email, r.coordinator_name, r.coordinator_phone]
      .some(v => v && String(v).toLowerCase().includes(q)));
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const va = val(a, sort.key), vb = val(b, sort.key);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
        return sort.dir === 'asc' ? c : -c;
      });
    }
    return list;
  }, [rows, search, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const allShownSelected = shown.length > 0 && shown.every(r => selected.has(r.id));
  function toggleAll() {
    setSelected(s => {
      const n = new Set(s);
      if (allShownSelected) shown.forEach(r => n.delete(r.id)); else shown.forEach(r => n.add(r.id));
      return n;
    });
  }
  function toggleOne(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function applyBulk(c) {
    const r = await api.post('/admin/mentor-directory/coordinator', { ids: [...selected], ...c });
    setBulk(false); setSelected(new Set()); setNotice(`Coordinator updated for ${r.data.updated} mentor${r.data.updated === 1 ? '' : 's'}.`);
    load();
  }
  async function confirmDelete() {
    try {
      await api.delete(`/admin/mentor-directory/${deleting.id}`);
      setDeleting(null); setNotice('Removed from the list.'); load();
    } catch (e) { setError(e.response?.data?.error || 'Delete failed'); setDeleting(null); }
  }

  function exportCsv() {
    const out = [cols.map(c => c.label), ...shown.map(r => kind === 'bvrv'
      ? [r.course_code ? `${className(r.course_name)} (${r.course_code})` : '', semText(r), r.name, r.phone, r.email, coordText(r)]
      : [r.language, r.name, r.phone, r.email, coordText(r)])];
    const blob = new Blob(['﻿' + out.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${kind}_mentors.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{meta.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{meta.hint}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <button onClick={() => setBulk(true)} className="btn-secondary text-sm">Set coordinator ({selected.size})</button>
          )}
          <button onClick={exportCsv} disabled={!shown.length} className="btn-secondary text-sm">Export CSV</button>
          <button onClick={() => setEditing({})} className="btn-primary text-sm">+ Add mentor</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{notice}</div>}

      {!rows ? <Spinner /> : (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-400">{search ? `${shown.length} of ${rows.length}` : `${rows.length}`} mentors</span>
            <input value={search} onChange={e => setSearch(e.target.value)} className="input text-sm w-72 max-w-full"
              placeholder={`Search ${kind === 'bvrv' ? 'course' : 'language'}, name, phone, email, coordinator`} />
          </div>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-8"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all" /></th>
                  {cols.map(c => (
                    <th key={c.key} className="text-left px-4 py-3 font-medium text-gray-500">
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-gray-800">
                        {c.label}
                        <span className={`text-[10px] ${sort.key === c.key ? 'text-gray-700' : 'text-gray-300'}`}>
                          {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.length === 0 && (
                  <tr><td colSpan={cols.length + 2} className="text-center py-10 text-gray-400">{search ? 'No matches.' : 'No mentors yet.'}</td></tr>
                )}
                {shown.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} /></td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {kind === 'bvrv'
                        ? (r.course_code
                          ? <>{className(r.course_name)} <span className="text-xs font-mono text-gray-400">{r.course_code}</span></>
                          : <span className="text-gray-300">—</span>)
                        : (r.language || <span className="text-gray-300">—</span>)}
                    </td>
                    {kind === 'bvrv' && (
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {r.semester_id ? (
                          <>
                            {r.semester_label}
                            {r.semester_is_current
                              ? <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>
                              : <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Past</span>}
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-gray-800">
                      {r.name}
                      {!r.user_id && <span className="ml-1 text-xs text-gray-400">(no account)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.coordinator_name || r.coordinator_phone
                        ? <><span className="text-gray-800">{r.coordinator_name}</span>{r.coordinator_phone && <span className="text-gray-500"> · {r.coordinator_phone}</span>}</>
                        : <span className="text-gray-300">Not set</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(r)} className="text-primary-600 hover:underline text-xs mr-3">Edit</button>
                      <button onClick={() => setDeleting(r)} className="text-red-600 hover:underline text-xs">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <MentorForm kind={kind} row={editing.id ? editing : null} people={people} subjects={subjects}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNotice('Saved.'); load(); }} />
      )}
      {bulk && <CoordinatorBulk count={selected.size} people={people} onClose={() => setBulk(false)} onApply={applyBulk} />}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm text-gray-800">Remove <b>{deleting.name}</b>{kind === 'bvrv' && deleting.course_code ? ` (${deleting.course_code})` : ''} from {meta.title}?</p>
            <p className="text-xs text-gray-400">Only the listing is removed. The user account stays.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={confirmDelete} className="btn-danger text-sm">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
