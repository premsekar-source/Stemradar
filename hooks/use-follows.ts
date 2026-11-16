'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const DOMAINS_STORAGE_KEY = 'stem-radar-followed-domains';
const KEYWORDS_STORAGE_KEY = 'stem-radar-followed-keywords';
const CHANGE_EVENT = 'stem-radar-follows-change';
export const MAX_FOLLOWED_KEYWORDS = 10;
export const MIN_KEYWORD_LENGTH = 2;
export const MAX_KEYWORD_LENGTH = 30;

interface FollowsSnapshot {
  domains: string[];
  keywords: string[];
  storageUnavailable: boolean;
}

// Session-only in-memory fallback used when localStorage is unavailable.
let memoryDomains: string[] = [];
let memoryKeywords: string[] = [];
let memoryStorageUnavailable: boolean | null = null;

const SERVER_SNAPSHOT_RAW = JSON.stringify({
  domains: [],
  keywords: [],
  storageUnavailable: false,
} satisfies FollowsSnapshot);

function detectStorageAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  if (memoryStorageUnavailable !== null) {
    return !memoryStorageUnavailable;
  }
  try {
    const testKey = '__stem_radar_follow_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    memoryStorageUnavailable = false;
    return true;
  } catch {
    memoryStorageUnavailable = true;
    return false;
  }
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function subscribeFollows(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === DOMAINS_STORAGE_KEY ||
      e.key === KEYWORDS_STORAGE_KEY ||
      e.key === null
    ) {
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getFollowsSnapshot(): string {
  if (!detectStorageAvailable()) {
    return JSON.stringify({
      domains: memoryDomains,
      keywords: memoryKeywords,
      storageUnavailable: true,
    } satisfies FollowsSnapshot);
  }

  try {
    const domains = parseStringArray(
      window.localStorage.getItem(DOMAINS_STORAGE_KEY)
    );
    const keywords = parseStringArray(
      window.localStorage.getItem(KEYWORDS_STORAGE_KEY)
    );
    memoryDomains = domains;
    memoryKeywords = keywords;
    return JSON.stringify({
      domains,
      keywords,
      storageUnavailable: false,
    } satisfies FollowsSnapshot);
  } catch {
    memoryStorageUnavailable = true;
    return JSON.stringify({
      domains: memoryDomains,
      keywords: memoryKeywords,
      storageUnavailable: true,
    } satisfies FollowsSnapshot);
  }
}

function getFollowsServerSnapshot(): string {
  return SERVER_SNAPSHOT_RAW;
}

function persistDomains(domains: string[]) {
  memoryDomains = domains;
  if (detectStorageAvailable()) {
    try {
      window.localStorage.setItem(DOMAINS_STORAGE_KEY, JSON.stringify(domains));
    } catch {
      memoryStorageUnavailable = true;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function persistKeywords(keywords: string[]) {
  memoryKeywords = keywords;
  if (detectStorageAvailable()) {
    try {
      window.localStorage.setItem(
        KEYWORDS_STORAGE_KEY,
        JSON.stringify(keywords)
      );
    } catch {
      memoryStorageUnavailable = true;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function useFollows() {
  const raw = useSyncExternalStore(
    subscribeFollows,
    getFollowsSnapshot,
    getFollowsServerSnapshot
  );

  const snapshot = useMemo<FollowsSnapshot>(() => {
    try {
      const parsed = JSON.parse(raw) as Partial<FollowsSnapshot>;
      return {
        domains: Array.isArray(parsed.domains) ? parsed.domains : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        storageUnavailable: Boolean(parsed.storageUnavailable),
      };
    } catch {
      return { domains: [], keywords: [], storageUnavailable: false };
    }
  }, [raw]);

  const followedDomainSet = useMemo(
    () => new Set(snapshot.domains),
    [snapshot.domains]
  );

  const isFollowingDomain = useCallback(
    (domainSlug: string) => followedDomainSet.has(domainSlug),
    [followedDomainSet]
  );

  const toggleFollowDomain = useCallback(
    (domainSlug: string) => {
      const next = new Set(snapshot.domains);
      if (next.has(domainSlug)) {
        next.delete(domainSlug);
      } else {
        next.add(domainSlug);
      }
      persistDomains(Array.from(next));
    },
    [snapshot.domains]
  );

  const addKeyword = useCallback(
    (rawInput: string): { ok: boolean; error?: string } => {
      const trimmed = rawInput.trim();
      if (
        trimmed.length < MIN_KEYWORD_LENGTH ||
        trimmed.length > MAX_KEYWORD_LENGTH
      ) {
        return {
          ok: false,
          error: `Keywords must be ${MIN_KEYWORD_LENGTH} to ${MAX_KEYWORD_LENGTH} characters.`,
        };
      }

      if (snapshot.keywords.length >= MAX_FOLLOWED_KEYWORDS) {
        return {
          ok: false,
          error: `You can follow up to ${MAX_FOLLOWED_KEYWORDS} keywords.`,
        };
      }

      const lower = trimmed.toLowerCase();
      if (snapshot.keywords.some((k) => k.toLowerCase() === lower)) {
        return {
          ok: false,
          error: `"${trimmed}" is already in your followed keywords.`,
        };
      }

      persistKeywords([...snapshot.keywords, trimmed]);
      return { ok: true };
    },
    [snapshot.keywords]
  );

  const removeKeyword = useCallback(
    (keyword: string) => {
      const lower = keyword.toLowerCase();
      persistKeywords(
        snapshot.keywords.filter((k) => k.toLowerCase() !== lower)
      );
    },
    [snapshot.keywords]
  );

  return {
    followedDomains: snapshot.domains,
    followedKeywords: snapshot.keywords,
    storageUnavailable: snapshot.storageUnavailable,
    isFollowingDomain,
    toggleFollowDomain,
    addKeyword,
    removeKeyword,
  };
}
