'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
}

function subscribeStandalone(callback: () => void) {
  const mql = window.matchMedia('(display-mode: standalone)');
  mql.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    mql.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

function subscribeNoop() {
  return () => {};
}

function getIPhoneSafariSnapshot(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isSafari =
    /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  return isIPhone && isSafari;
}

function getFalseSnapshot(): boolean {
  return false;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getFalseSnapshot
  );

  const isIPhoneSafari = useSyncExternalStore(
    subscribeNoop,
    getIPhoneSafariSnapshot,
    getFalseSnapshot
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setJustInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker in production builds only, using relative ./ path
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .catch(() => {
          // Ignore registration failures in unsupported contexts
        });
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setJustInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const isInstalled = isStandalone || justInstalled;

  return {
    canInstall: !isInstalled && deferredPrompt !== null,
    showIPhoneSafariHint: !isInstalled && deferredPrompt === null && isIPhoneSafari,
    isInstalled,
    install,
  };
}
