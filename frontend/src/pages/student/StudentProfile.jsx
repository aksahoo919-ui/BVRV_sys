import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

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
      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <p className="text-sm text-gray-400 mt-0.5">Your account information</p>
      </div>

      {/* Avatar + name card */}
      <div className="card mb-4 flex items-center gap-4">
        {profile.profile_photo_url ? (
          <img
            src={profile.profile_photo_url}
            alt={profile.name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
            {initials}
          </div>
        )}
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
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Roll Number</p>
            <p className="text-sm text-gray-500">{profile.roll_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Department</p>
            <p className="text-sm text-gray-500">{profile.department_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Course</p>
            <p className="text-sm text-gray-500">{profile.course_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Account Status</p>
            <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              Active
            </span>
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
              <p className="text-sm text-gray-800">{profile.phone || <span className="text-gray-400 italic">Not set</span>}</p>
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
                  : <span className="text-gray-400 italic">Not set</span>}
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
          <p className="mt-3 text-xs text-gray-400">
            Last updated: {daysAgo(profile.profile_updated_at)}
          </p>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
