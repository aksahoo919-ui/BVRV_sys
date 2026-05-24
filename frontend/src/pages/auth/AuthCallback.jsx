import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { jwtDecode } from '../../utils/jwt';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Clear token from URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    try {
      const decoded = jwtDecode(token);
      login(token);

      if (decoded.role === 'admin') navigate('/admin', { replace: true });
      else if (decoded.role === 'teacher') navigate('/teacher', { replace: true });
      else if (decoded.role === 'mentor') navigate('/mentor', { replace: true });
      else if (decoded.role === 'student') navigate('/student', { replace: true });
      else navigate('/auth/pending', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
