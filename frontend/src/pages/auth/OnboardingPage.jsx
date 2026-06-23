import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const ROLES = [
  { value: 'student',    label: 'Student',    icon: '🎓', desc: 'I am enrolled in courses' },
  { value: 'teacher',    label: 'Teacher',    icon: '👨‍🏫', desc: 'I teach subjects' },
  { value: 'mentor',     label: 'BV Leader',  icon: '🤝', desc: 'I guide & counsel students' },
  { value: 'admin',      label: 'Admin',      icon: '🔐', desc: 'I manage the institution', adminNote: true },
];

export default function OnboardingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const name = params.get('name') || '';
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/onboarding', { email, role: selected });
      navigate('/auth/pending', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {name || 'there'}!</h1>
          <p className="text-gray-500 text-sm mt-1">{email}</p>
          <p className="text-gray-600 mt-3">Select your role to continue.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected === r.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">{r.icon}</div>
              <div className="font-semibold text-gray-800 text-sm">{r.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
              {r.adminNote && (
                <div className="text-xs text-amber-600 mt-1 font-medium">
                  Requires existing admin approval
                </div>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={!selected || loading} className="btn-primary w-full">
          {loading ? 'Submitting…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
