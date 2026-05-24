import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function InstructorClasses() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/instructor/subjects').then(r => setSubjects(r.data)).finally(() => setLoading(false));
  }, []);

  async function startSession(subjectId) {
    setOpeningId(subjectId);
    try {
      const r = await api.post('/instructor/sessions/open', { subject_id: subjectId });
      navigate(`/instructor/session/${r.data.session_id}`, { state: { pin: r.data.pin_display, expiresAt: r.data.expires_at } });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to open session');
    } finally {
      setOpeningId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Classes</h1>
      {subjects.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No subjects assigned yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => (
            <div key={s.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className="font-mono text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{s.code}</span>
                <span className="text-xs text-gray-400">{s.student_count} students</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{s.name}</h3>
              <p className="text-xs text-gray-400 mb-4">
                Last session: {s.last_session_date ? new Date(s.last_session_date).toLocaleDateString() : 'Never'}
              </p>
              <button
                onClick={() => startSession(s.id)}
                disabled={openingId === s.id}
                className="btn-primary w-full text-sm"
              >
                {openingId === s.id ? 'Opening…' : 'Start Session'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
