import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Shows a "Switch to Mentor / Teacher" button for dual-capable users.
// Swaps the active role (new token) and moves to the other portal,
// with a brief full-screen loading animation.
export default function RoleSwitcher() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const role = user?.role;
  if (role !== 'teacher' && role !== 'mentor') return null;

  const target = role === 'teacher' ? 'mentor' : 'teacher';
  const targetLabel = target.charAt(0).toUpperCase() + target.slice(1);

  async function handleSwitch() {
    setSwitching(true);
    try {
      const res = await api.post('/auth/switch-role');
      // brief pause so the transition feels smooth
      await new Promise((r) => setTimeout(r, 650));
      login(res.data.token);
      navigate(`/${target}/home`, { replace: true });
    } catch (e) {
      setSwitching(false);
      alert(e.response?.data?.error || 'Could not switch role');
    }
  }

  return (
    <>
      <button
        onClick={handleSwitch}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        title={`Switch to ${targetLabel} view`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m4 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span className="hidden sm:inline">Switch to {targetLabel}</span>
      </button>

      {switching && (
        <div className="fixed inset-0 z-[60] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm font-medium text-gray-600">Switching to {targetLabel}…</p>
        </div>
      )}
    </>
  );
}
