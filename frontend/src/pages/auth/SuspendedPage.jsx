import React from 'react';
import { Link } from 'react-router-dom';

export default function SuspendedPage({ message }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-gray-600 text-sm">
          {message || 'Your account has been suspended. Please contact the administrator.'}
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
