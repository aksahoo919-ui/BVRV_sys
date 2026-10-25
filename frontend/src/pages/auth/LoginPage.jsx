import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { jwtDecode } from '../../utils/jwt';
import { TempleMark } from '../../components/TempleMark';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Still signed in (session restored after a reload) → straight to the portal.
  if (user?.status === 'active' && ['admin', 'teacher', 'mentor', 'student'].includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username: username.trim(), password });
      const token = res.data.token;
      login(token);
      const { role } = jwtDecode(token) || {};
      navigate(role ? `/${role}` : '/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-temple-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* The mandir's cusped-arch stonework, very faint, as the ground. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
           style={{
             backgroundImage:
               "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='70' viewBox='0 0 120 70'><path d='M0 70 Q30 4 60 70 Q90 4 120 70' fill='none' stroke='%23E0B750' stroke-width='2'/></svg>\")",
             backgroundSize: '120px 70px',
           }} />
      <Link
        to="/guide"
        className="fixed top-4 right-4 z-10 flex items-center gap-1.5 bg-white/80 backdrop-blur border border-gray-200 text-primary-700 text-sm font-medium px-3.5 py-2 rounded-lg shadow-sm hover:bg-white hover:shadow transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        User Guide
      </Link>
      <div className="relative w-full max-w-sm bg-ivory-50 rounded-2xl shadow-altar border border-gold-600/40 overflow-hidden">
        {/* marigold + mango-leaf toran along the top edge */}
        <div className="toran" aria-hidden="true" />
        <div className="p-6">
        <div className="mb-6 text-center">
          <TempleMark className="w-20 h-20 mx-auto mb-3" tone="gold" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-temple-600">ISKCON Abids · Hyderabad</p>
          <h1 className="font-temple text-3xl text-temple-800 leading-tight mt-1">Sri Sri Radha Madanmohan</h1>
          <div className="arch-rule my-3" aria-hidden="true" />
          <p className="text-temple-700 text-sm font-medium inline-flex items-center min-h-[24px]">BVRV Attendance</p>
          <p className="text-gray-500 text-sm">Sign in to continue</p>
        </div>

        {/* Username + password */}
        <form onSubmit={handleLogin} className="space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="email or username"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-gray-500 text-center">
            <Link to="/auth/forgot-password" className="text-primary-600 hover:underline inline-flex items-center min-h-[24px]">Forgot password?</Link>
            {' '}(staff) · students contact your administrator.
          </p>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <a
          href={`${import.meta.env.VITE_API_URL || '/api'}/auth/google`}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Sign in with Google
        </a>

        <p className="mt-6 text-xs text-gray-500 text-center">
          Administrator?{' '}
          <Link to="/admin/login" className="text-primary-600 hover:underline inline-flex items-center min-h-[24px]">
            Admin login
          </Link>
        </p>
        </div>
      </div>

      <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-temple-200 px-4">
        Hare Krishna Land, Nampally Station Road, Abids, Hyderabad
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
