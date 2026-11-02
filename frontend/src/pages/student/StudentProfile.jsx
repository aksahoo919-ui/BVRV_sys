import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import ChangeRequests from '../../components/ChangeRequests';

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
      <svg className="w-4 h-4 text-temple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

export default function StudentProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);

  // Editable field state
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/student/profile');
        setProfile(res.data);
        setPhone(res.data.phone || '');
        setDob(res.data.date_of_birth ? res.data.date_of_birth.slice(0, 10) : '');
      } catch {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setToast('Photo must be under 4 MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setToast('Only JPG, PNG or WEBP allowed'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/auth/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
      setToast('Profile photo updated');
    } catch {
      setToast('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleEdit() {
    setPhone(profile.phone || '');
    setDob(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
    setEditMode(true);
  }

  function handleCancel() {
    setEditMode(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.patch('/student/profile', {
        phone: phone || null,
        date_of_birth: dob || null,
      });
      setProfile((prev) => ({
        ...prev,
        phone: phone || null,
        date_of_birth: dob || null,
        profile_updated_at: new Date().toISOString(),
        ...(res.data || {}),
      }));
      setEditMode(false);
      setToast('Profile updated');
    } catch {
      setToast('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  const initials = profile.name
    ? profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your account information</p>
      </div>

      {/* Avatar + name card */}
      <div className="card mb-4 flex items-center gap-4">
        <div className="relative flex-shrink-0 group">
          {(profile.avatar_url || profile.profile_photo_url) ? (
            <img
              src={profile.avatar_url || profile.profile_photo_url}
              alt={profile.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
          )}
          <label
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100' : ''}`}
            title="Change photo"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
          </label>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">{profile.name}</p>
          <p className="text-sm text-gray-500 truncate">{profile.email}</p>
          <span className="mt-1 inline-block bg-primary-100 text-primary-700 text-xs font-semibold px-2 py-0.5 rounded-full capitalize">
            {profile.role || 'Student'}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {/* Non-editable fields */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Roll Number</p>
            <p className="text-sm text-gray-500">{profile.roll_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Account Status</p>
            <span className="inline-block bg-temple-100 text-temple-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Courses</p>
            {profile.courses && profile.courses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.courses.map((c) => (
                  <span key={c.id} className="inline-block bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {c.code ? `${c.code} — ` : ''}{c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not enrolled in any course yet.</p>
            )}
          </div>

          {/* Divider */}
          <div className="sm:col-span-2 border-t border-gray-100" />

          {/* Editable: Phone */}
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Phone</p>
            {editMode ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="input w-full"
              />
            ) : (
              <p className="text-sm text-gray-800">{profile.phone || <span className="text-gray-500 italic">Not set</span>}</p>
            )}
          </div>

          {/* Editable: Date of Birth */}
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Date of Birth</p>
            {editMode ? (
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input w-full"
              />
            ) : (
              <p className="text-sm text-gray-800">
                {profile.date_of_birth
                  ? new Date(profile.date_of_birth).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : <span className="text-gray-500 italic">Not set</span>}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center gap-3">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm px-4 py-2 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="text-sm px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Last updated */}
        {profile.profile_updated_at && (
          <p className="mt-3 text-xs text-gray-500">
            Last updated: {daysAgo(profile.profile_updated_at)}
          </p>
        )}
      </div>

      <ChangeRequests />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
