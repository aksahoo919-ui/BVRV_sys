import React, { createContext, useContext, useState, useCallback } from 'react';
import { jwtDecode } from '../utils/jwt';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const login = useCallback((rawToken) => {
    try {
      const decoded = jwtDecode(rawToken);
      setToken(rawToken);
      setUser(decoded);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
