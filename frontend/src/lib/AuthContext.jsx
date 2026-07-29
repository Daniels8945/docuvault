import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const AuthCtx = createContext(null);

const TOKEN_KEY = 'dv-token';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser]   = useState(null);

  // Attach / remove the Authorization header on the shared axios instance
  const applyToken = useCallback((t) => {
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  // Called once on app start if a stored token exists
  const restoreToken = useCallback((t, u) => {
    setToken(t);
    setUser(u);
    applyToken(t);
  }, [applyToken]);

  const login = useCallback((t, u) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    applyToken(t);
  }, [applyToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    applyToken(null);
  }, [applyToken]);

  // Apply any already-stored token immediately (for page refreshes)
  if (token && !axios.defaults.headers.common['Authorization']) {
    applyToken(token);
  }

  return (
    <AuthCtx.Provider value={{ token, user, setUser, login, logout, restoreToken }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
