import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function StudentMentor() {
  const [mentor, setMentor] = useState(undefined); // undefined = not loaded yet, null = no mentor
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/student/mentor');
        // API returns either the mentor object or { mentor: null }
        if (res.data && res.data.mentor === null) {
          setMentor(null);
        } else if (res.data && res.data.id) {
          setMentor(res.data);
        } else {
          setMentor(null);
        }
      } catch {
        setError('Failed to load mentor information.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  const initials = mentor?.name
    ? mentor.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Mentor</h1>
        <p className="text-sm text-gray-400 mt-0.5">Academic mentor information</p>
      </div>

      {mentor === null ? (
        <div className="card text-center py-16">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No mentor assigned yet.</p>
          <p className="text-gray-400 text-sm mt-1">Please contact admin to get a mentor assigned.</p>
        </div>
      ) : (
        <div className="card">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-5">
            {mentor.profile_photo_url ? (
              <img
                src={mentor.profile_photo_url}
                alt={mentor.name}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0 ring-2 ring-primary-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold flex-shrink-0 ring-2 ring-primary-50">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900">{mentor.name}</p>
              {mentor.employee_id && (
                <p className="text-sm text-gray-500 mt-0.5">ID: {mentor.employee_id}</p>
              )}
              {mentor.department_name && (
                <p className="text-sm text-gray-500">{mentor.department_name}</p>
              )}
            </div>
          </div>

          {/* Contact details */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</p>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <a
                href={`mailto:${mentor.email}`}
                className="text-sm text-primary-600 hover:underline truncate"
              >
                {mentor.email}
              </a>
            </div>

            {mentor.phone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">{mentor.phone}</span>
              </div>
            )}
          </div>

          {/* Send Email button */}
          <div className="mt-5 flex flex-col gap-3">
            <button
              onClick={() => { window.location.href = 'mailto:' + mentor.email; }}
              className="flex items-center justify-center gap-2 w-full btn-primary text-sm py-2.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </button>

            {/* Info note */}
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-600">
                Your mentor is available for academic guidance and counseling.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
