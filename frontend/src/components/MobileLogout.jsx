import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Logout for the mobile top bar (TopNav is hidden below lg in the admin/teacher layouts).
export default function MobileLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { logout(); navigate('/login', { replace: true }); }}
      className="ml-auto flex items-center gap-1 text-sm font-medium text-red-600 px-2 py-1"
      aria-label="Log out"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Logout
    </button>
  );
}
