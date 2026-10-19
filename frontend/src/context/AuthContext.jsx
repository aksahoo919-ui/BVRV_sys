import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { jwtDecode } from '../utils/jwt';
import { setTokenGetter } from '../utils/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bvrv_token';

// Valid, unexpired token from storage → { token, user }; anything else is cleared.
function readStored(raw = localStorage.getItem(STORAGE_KEY)) {
  if (!raw) return { token: null, user: null };
  try {
    const user = jwtDecode(raw);
    if (user.exp && user.exp * 1000 > Date.now()) return { token: raw, user };
  } catch { /* fall through */ }
  localStorage.removeItem(STORAGE_KEY);
  return { token: null, user: null };
}

// Read synchronously by the axios interceptor, so requests made by child
// components on the very first render after a reload already carry the token.
let currentToken = null;
setTokenGetter(() => currentToken);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const stored = readStored();
    currentToken = stored.token;
    return stored;
  });

  const login = useCallback((rawToken) => {
    try {
      const user = jwtDecode(rawToken);
      currentToken = rawToken;
      localStorage.setItem(STORAGE_KEY, rawToken);
      setAuth({ token: rawToken, user });
    } catch {
      currentToken = null;
      localStorage.removeItem(STORAGE_KEY);
      setAuth({ token: null, user: null });
    }
  }, []);

  const logout = useCallback(() => {
    currentToken = null;
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ token: null, user: null });
  }, []);

  // Log out when the token expires while the page stays open.
  useEffect(() => {
    if (!auth.user?.exp) return;
    const ms = auth.user.exp * 1000 - Date.now();
    const t = setTimeout(logout, Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(t);
  }, [auth.user, logout]);

  // Keep other tabs in sync (login / logout / role switch in another tab).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readStored(e.newValue);
      currentToken = next.token;
      setAuth(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ token: auth.token, user: auth.user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
