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
      <div className="card max-w-md">
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
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
