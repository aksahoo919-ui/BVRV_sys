import React from 'react';
import { Link } from 'react-router-dom';

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
        <p className="text-gray-600 text-sm">
          Your account is pending approval by the administrator. You'll be able to log in once approved.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
