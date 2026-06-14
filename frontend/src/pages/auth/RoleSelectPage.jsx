import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const VIEWS = [
  {
    role: 'teacher',
    label: 'Teacher View',
    desc: 'Take attendance, manage marks, and handle classes.',
    color: 'border-blue-300 hover:border-blue-500 hover:bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    icon: (
      <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    role: 'mentor',
    label: 'Mentor View',
    desc: 'Guide students, track their progress, and manage counseling.',
    color: 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: (
      <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export default function RoleSelectPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  async function selectRole(role) {
    setLoading(role);
    setError('');
    try {
      const r = await api.post('/auth/select-role', { role });
      login(r.data.token);
      navigate(role === 'teacher' ? '/teacher' : '/mentor', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to switch view. Please try again.');
      setLoading(null);
    }
  }

  const availableViews = VIEWS.filter(v =>
    v.role === user?.role || v.role === user?.secondary_role
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">BVRV Attendance</p>
          <h1 className="text-2xl font-bold text-gray-900">Choose your view</h1>
          <p className="text-gray-500 mt-1 text-sm">
            You have multiple roles. Select how you'd like to continue.
          </p>
        </div>

        <div className="space-y-3">
          {availableViews.map(({ role, label, desc, color, badge, icon }) => (
            <button
              key={role}
              onClick={() => selectRole(role)}
              disabled={loading !== null}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-white transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed ${color}`}
            >
              <div className="flex-shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>{role}</span>
                </div>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
              {loading === role ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
