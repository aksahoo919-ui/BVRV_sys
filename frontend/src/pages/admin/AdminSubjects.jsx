import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const EMPTY_FORM = { code: '', name: '', course_id: '', academic_year_id: '', credits: 3 };

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | subject object
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [subjRes, courseRes, yearRes] = await Promise.all([
        api.get('/admin/subjects'),
        api.get('/admin/courses'),
        api.get('/admin/academic-years'),
      ]);
      setSubjects(subjRes.data);
      setCourses(courseRes.data);
      setAcademicYears(yearRes.data);
    } catch {
      setLoadError('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    const currentYear = academicYears.find(y => y.is_current) || academicYears[0];
    setForm({ ...EMPTY_FORM, academic_year_id: currentYear?.id ?? '' });
    setFormError('');
    setModal('add');
  }

  function openEdit(s) {
    setForm({
      code: s.code,
      name: s.name,
      course_id: s.course_id ?? '',
      academic_year_id: s.academic_year_id ?? '',
      credits: s.credits ?? 3,
    });
    setFormError('');
    setModal(s);
  }

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.code.trim()) { setFormError('Subject Code is required'); return; }
    if (!form.name.trim()) { setFormError('Subject Name is required'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      course_id: form.course_id,
      academic_year_id: form.academic_year_id,
      credits: Number(form.credits),
    };
    try {
      if (modal === 'add') {
        await api.post('/admin/subjects', payload);
      } else {
        await api.patch(`/admin/subjects/${modal.id}`, payload);
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this subject?')) return;
    try {
      await api.delete(`/admin/subjects/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Subjects</h1>
        <button onClick={openAdd} className="btn-primary text-sm">+ Add Subject</button>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h2 className="font-bold text-gray-900 mb-4">
              {modal === 'add' ? 'Add Subject' : 'Edit Subject'}
            </h2>

            <label className="block text-sm text-gray-600 mb-1">Subject Code <span className="text-red-500">*</span></label>
            <input
              className="input mb-3"
              value={form.code}
              onChange={e => setField('code', e.target.value.toUpperCase())}
              placeholder="e.g. CS101"
            />

            <label className="block text-sm text-gray-600 mb-1">Subject Name <span className="text-red-500">*</span></label>
            <input
              className="input mb-3"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g. Introduction to Computer Science"
            />

            <label className="block text-sm text-gray-600 mb-1">Course</label>
            <select
              className="input mb-1"
              value={form.course_id}
              onChange={e => setField('course_id', e.target.value)}
            >
              <option value="">— Select a course —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
            {courses.length === 0 && (
              <p className="text-xs text-amber-600 mb-3">No courses yet — add one under Academic → Courses first.</p>
            )}
            {courses.length > 0 && <div className="mb-3" />}

            <label className="block text-sm text-gray-600 mb-1">Academic Year</label>
            <select
              className="input mb-1"
              value={form.academic_year_id}
              onChange={e => setField('academic_year_id', e.target.value)}
            >
              <option value="">— Select an academic year —</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.label}{y.is_current ? ' (Current)' : ''}
                </option>
              ))}
            </select>
            {academicYears.length === 0 && (
              <p className="text-xs text-amber-600 mb-3">No academic years yet — add one under Academic → Academic Years first.</p>
            )}
            {academicYears.length > 0 && <div className="mb-3" />}

            <label className="block text-sm text-gray-600 mb-1">Credits</label>
            <input
              type="number"
              className="input mb-4"
              value={form.credits}
              min={1}
              onChange={e => setField('credits', e.target.value)}
            />

            {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : loadError ? (
        <div className="card text-center text-red-600 py-8">{loadError}</div>
      ) : subjects.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">No subjects yet.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Course</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Academic Year</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Credits</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjects.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-primary-700">{s.code}</td>
                  <td className="px-4 py-3 text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {s.course_code ? `${s.course_code} — ${s.course_name}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                    {s.academic_year_label || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{s.credits ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(s)} className="btn-secondary py-1 px-2 text-xs">Edit</button>
                      <button onClick={() => handleDelete(s.id)} className="btn-danger py-1 px-2 text-xs">Delete</button>
                    </div>
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

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
