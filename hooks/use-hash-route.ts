'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type HashRoute =
  | { page: 'dashboard' }
  | { page: 'for-you' }
  | { page: 'domain'; domainSlug: string }
  | { page: 'item'; itemSlug: string }
  | { page: 'sources' }
  | { page: 'saved' }
  | { page: 'read-later' }
  | { page: 'about' }
  | { page: 'method' }
  | { page: 'privacy' }
  | { page: 'contact'; reportTitle?: string; reportUrl?: string }
  | { page: 'not-found'; rawHash: string };

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getHashSnapshot(): string {
  return window.location.hash || '#/';
}

function getHashServerSnapshot(): string {
  return '#/';
}

export function parseHashRoute(hash: string): HashRoute {
  const cleaned = hash.replace(/^#/, '') || '/';
  const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const [pathOnly, queryString = ''] = normalized.split('?');

  if (pathOnly === '/' || pathOnly === '') {
    return { page: 'dashboard' };
  }

  if (pathOnly === '/for-you') {
    return { page: 'for-you' };
  }

  if (pathOnly === '/sources') {
    return { page: 'sources' };
  }

  if (pathOnly === '/saved') {
    return { page: 'saved' };
  }

  if (pathOnly === '/read-later') {
    return { page: 'read-later' };
  }

  if (pathOnly === '/about') {
    return { page: 'about' };
  }

  if (pathOnly === '/method') {
    return { page: 'method' };
  }

  if (pathOnly === '/privacy') {
    return { page: 'privacy' };
  }

  if (pathOnly === '/contact') {
    const params = new URLSearchParams(queryString);
    const reportTitle = params.get('title')?.trim() || undefined;
    const reportUrl = params.get('url')?.trim() || undefined;
    return { page: 'contact', reportTitle, reportUrl };
  }

  if (pathOnly.startsWith('/domain/')) {
    const slug = decodeURIComponent(pathOnly.slice('/domain/'.length)).replace(/\/+$/, '');
    if (slug) {
      return { page: 'domain', domainSlug: slug };
    }
  }

  if (pathOnly.startsWith('/item/')) {
    const slug = decodeURIComponent(pathOnly.slice('/item/'.length)).replace(/\/+$/, '');
    if (slug) {
      return { page: 'item', itemSlug: slug };
    }
  }

  return { page: 'not-found', rawHash: hash };
}

export function useHashRoute() {
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getHashServerSnapshot
  );

  const route = useMemo(() => parseHashRoute(hash), [hash]);

  const navigate = useCallback((targetHash: string) => {
    const formatted = targetHash.startsWith('#')
      ? targetHash
      : `#${targetHash.startsWith('/') ? targetHash : `/${targetHash}`}`;
    if (window.location.hash !== formatted) {
      window.location.hash = formatted;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { hash, route, navigate };
}
