import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

// Placeholder addresses the importer made for devotees who gave no email.
export const isPlaceholderEmail = e => /@noemail\.bvrv$/i.test(String(e || ''));

/**
 * Lets a BVRV teacher or BV Leader correct a devotee's material name, email,
 * phone number, initiated name and profile photo. `endpoint` is the role's
 * own scoped route, e.g. `/teacher/students/<id>/contact` or
 * `/mentor/students/<id>/contact`; `photoEndpoint` is the matching
 * `.../photo` route. The server refuses devotees who are not in that
 * teacher's class or that leader's group, and audit-logs every change.
 */
export default function EditDevoteeContact({ devotee, endpoint, photoEndpoint, onClose, onSaved }) {
  const [name, setName] = useState(devotee.name || '');
  const [email, setEmail] = useState(isPlaceholderEmail(devotee.email) ? '' : devotee.email || '');
  const [phone, setPhone] = useState(devotee.phone || '');
  const [initiated, setInitiated] = useState(devotee.initiated_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(devotee.avatar_url || '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const firstField = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name cannot be left blank.'); return; }
    const body = { name: name.trim(), phone, initiated_name: initiated };
    // Leaving the email blank keeps a placeholder address rather than wiping it.
    if (email.trim()) body.email = email.trim();
    else if (devotee.email && !isPlaceholderEmail(devotee.email)) {
      setError('Email cannot be left blank. Keep the old address if there is no new one.');
      return;
    }
    setSaving(true);
    try {
      const r = await api.patch(endpoint, body);
      onSaved(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !photoEndpoint) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const r = await api.post(photoEndpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAvatarUrl(r.data.avatar_url);
      onSaved({ ...devotee, ...r.data });
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Could not upload photo.');
    } finally {
      setPhotoUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-devotee-title"
        className="w-full sm:max-w-md bg-ivory-50 rounded-t-2xl sm:rounded-2xl shadow-altar border border-ivory-300 overflow-hidden"
      >
        <div className="toran" aria-hidden="true" />
        <div className="p-5 space-y-4">
          <div>
            <h2 id="edit-devotee-title" className="text-lg font-semibold text-temple-800">Update devotee details</h2>
            <p className="text-sm text-gray-600 mt-0.5">{initiated || devotee.name}</p>
          </div>

          {photoEndpoint && (
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-ivory-300" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-temple-100 text-temple-800 font-bold text-xl flex items-center justify-center select-none">
                  {(devotee.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={photoUploading}
                  className="btn-secondary text-sm py-1.5 px-3">
                  {photoUploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
                {photoError && <p className="text-xs text-red-700 mt-1" role="alert">{photoError}</p>}
              </div>
            </div>
          )}

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Legal / material name" maxLength={120} />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Initiated name</span>
            <input ref={firstField} className="input" value={initiated} onChange={e => setInitiated(e.target.value)}
              placeholder="e.g. Madhava Das" maxLength={120} />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Phone number</span>
            <input className="input" type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="10-digit mobile number" />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Email</span>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={isPlaceholderEmail(devotee.email) ? 'No email on record yet' : 'name@example.com'} />
          </label>

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
