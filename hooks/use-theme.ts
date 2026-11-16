'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'stem-radar-theme';
const THEME_EVENT = 'stem-radar-theme-change';

function subscribeTheme(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === null) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemeSnapshot(): ThemeMode {
  try {
    const val = window.localStorage.getItem(THEME_KEY);
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function getThemeServerSnapshot(): ThemeMode {
  return 'dark';
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_KEY, next);
      window.dispatchEvent(new Event(THEME_EVENT));
    } catch {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  }, [theme]);

  return { theme, toggleTheme };
}
