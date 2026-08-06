import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext({ isDark: true, toggle: () => {} });

// Must match --c-bg in index.css for dark/light — this is what colors the
// mobile browser's own chrome (status bar strip, and on iOS the safe-area
// bar under viewport-fit=cover), which otherwise sits outside our CSS entirely
// and stays a fixed color no matter what theme the app itself is in.
const THEME_COLOR = { dark: '#07090f', light: '#f5f5f7' };

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('dv-theme') !== 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDark);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [isDark]);

  const toggle = () => setIsDark(d => {
    const next = !d;
    localStorage.setItem('dv-theme', next ? 'dark' : 'light');
    return next;
  });

  return <ThemeCtx.Provider value={{ isDark, toggle }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
