'use client';

import { useCallback, useEffect, useState } from 'react';

const LAST_VISIT_KEY = 'stem-radar-last-visit';
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function readPreviousVisitMs(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const asDate = new Date(raw).getTime();
      return Number.isFinite(asDate) && asDate > 0 ? asDate : null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeVisitTimestamp(ts: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_VISIT_KEY, String(ts));
  } catch {
    // Ignore when localStorage is unavailable
  }
}

/**
 * Tracks the user's previous visit timestamp from localStorage.
 * - On very first visit or if localStorage is unavailable, returns null (no "New" badges).
 * - Never overwrites the stored timestamp on initial load.
 * - Updates localStorage when the app closes/hides or after 30 minutes of use.
 */
export function usePreviousVisit() {
  const [previousVisitMs] = useState<number | null>(() => readPreviousVisitMs());

  useEffect(() => {
    const persistVisit = () => {
      writeVisitTimestamp(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistVisit();
      }
    };

    const timerId = window.setTimeout(persistVisit, THIRTY_MINUTES_MS);
    window.addEventListener('pagehide', persistVisit);
    window.addEventListener('beforeunload', persistVisit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('pagehide', persistVisit);
      window.removeEventListener('beforeunload', persistVisit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const isNewSincePreviousVisit = useCallback(
    (discoveredAt: string | null | undefined): boolean => {
      if (previousVisitMs === null || !discoveredAt) return false;
      const discoveredMs = new Date(discoveredAt).getTime();
      if (Number.isNaN(discoveredMs)) return false;
      return discoveredMs > previousVisitMs;
    },
    [previousVisitMs]
  );

  return { previousVisitMs, isNewSincePreviousVisit };
}
