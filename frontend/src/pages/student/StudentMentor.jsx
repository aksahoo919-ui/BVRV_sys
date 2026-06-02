import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function initialsOf(name) {
  return name ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
}

export default function StudentMentor() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/student/mentor');
        setMentors(res.data?.mentors ?? []);
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

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Mentors</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your mentor for each class</p>
      </div>

      {mentors.length === 0 ? (
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
        <div className="space-y-3">
          {mentors.map((m) => (
            <div key={m.subject_id} className="card flex items-center gap-4">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.mentor_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0 ring-2 ring-primary-100" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {initialsOf(m.mentor_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  {m.subject_code} · {m.subject_name}
                </p>
                <p className="text-lg font-bold text-gray-900 leading-tight">{m.mentor_name}</p>
                <a href={`mailto:${m.mentor_email}`} className="text-sm text-primary-600 hover:underline truncate block">
                  {m.mentor_email}
                </a>
                {m.phone && <p className="text-sm text-gray-500">{m.phone}</p>}
              </div>
              <a
                href={`mailto:${m.mentor_email}`}
                className="btn-primary text-sm py-2 px-3 flex-shrink-0"
              >
                Email
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
