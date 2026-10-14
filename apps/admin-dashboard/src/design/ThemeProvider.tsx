'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Mode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'syntropi_theme';

interface ThemeState {
  mode: Mode;
  setMode: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeState>({ mode: 'system', setMode: () => {} });

export const useTheme = () => useContext(ThemeContext);

/** Runs before hydration (inlined in <head>) so the first paint already has the right mode. */
export const themeBootScript = `
(function(){try{
  var m=localStorage.getItem('${STORAGE_KEY}')||'system';
  var r=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;
  document.documentElement.dataset.mode=r;
}catch(e){document.documentElement.dataset.mode='light';}})();
`;

function resolveMode(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('system');

  // Read the stored choice once on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Mode | null;
      if (stored) setModeState(stored);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  // Apply to <html> and persist. "system" follows the OS setting live.
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.mode = resolveMode(mode);
    };
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}
