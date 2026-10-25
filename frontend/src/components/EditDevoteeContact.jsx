import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

// Placeholder addresses the importer made for devotees who gave no email.
export const isPlaceholderEmail = e => /@noemail\.bvrv$/i.test(String(e || ''));

/**
 * Lets a BVRV teacher or BV Leader correct a devotee's email, phone number and
 * initiated name. `endpoint` is the role's own scoped route, e.g.
 * `/teacher/students/<id>/contact` or `/mentor/students/<id>/contact`; the
 * server refuses devotees who are not in that teacher's class or that leader's
 * group, and audit-logs every change.
 */
export default function EditDevoteeContact({ devotee, endpoint, onClose, onSaved }) {
  const [email, setEmail] = useState(isPlaceholderEmail(devotee.email) ? '' : devotee.email || '');
  const [phone, setPhone] = useState(devotee.phone || '');
  const [initiated, setInitiated] = useState(devotee.initiated_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e) {
    e.preventDefault();
    setError('');
    const body = { phone, initiated_name: initiated };
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
            <p className="text-sm text-gray-600 mt-0.5">{devotee.name}</p>
          </div>

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
