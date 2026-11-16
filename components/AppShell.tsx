'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Bookmark,
  Clock,
  Compass,
  Download,
  LayoutGrid,
  Moon,
  Radar,
  Rss,
  Search,
  Server,
  Share,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import { DOMAINS } from '@/data/domains';
import { cn, formatRelativeSavedTime } from '@/lib/utils';
import type { HashRoute } from '@/hooks/use-hash-route';
import type { ThemeMode } from '@/hooks/use-theme';
import { DataModePill, DomainDot } from './Badges';

interface GlobalSearchInputProps {
  initialValue: string;
  onDebouncedSearchChange: (q: string) => void;
}

function GlobalSearchInput({
  initialValue,
  onDebouncedSearchChange,
}: GlobalSearchInputProps) {
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimer();
    };
  }, [clearPendingTimer]);

  const handleValueChange = (next: string) => {
    setLocalValue(next);
    clearPendingTimer();
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      onDebouncedSearchChange(next);
    }, 200);
  };

  const handleClearImmediate = useCallback(() => {
    clearPendingTimer();
    setLocalValue('');
    onDebouncedSearchChange('');
    inputRef.current?.focus();
  }, [clearPendingTimer, onDebouncedSearchChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (localValue.length > 0) {
          event.preventDefault();
          clearPendingTimer();
          setLocalValue('');
          onDebouncedSearchChange('');
        } else if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
        return;
      }

      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target?.isContentEditable;
        if (!isEditable) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localValue, clearPendingTimer, onDebouncedSearchChange]);

  return (
    <div className="relative order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:max-w-md min-w-0">
      <label htmlFor="global-search" className="sr-only">
        Search discoveries and sources (press slash to focus, Escape to clear)
      </label>
      <Search
        className="w-4 h-4 text-[#475569] dark:text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        value={localValue}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder="Search discoveries, sources..."
        className="w-full min-h-[44px] pl-9 pr-11 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#475569] dark:placeholder:text-[#94a3b8] focus:border-[#1b4dff] dark:focus:border-[#7da1ff]"
      />
      {localValue ? (
        <button
          type="button"
          onClick={handleClearImmediate}
          aria-label="Clear search"
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-mono text-[#475569] dark:text-[#94a3b8] border border-[#64748b] dark:border-[#64748b] rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          /
        </kbd>
      )}
    </div>
  );
}

interface AppShellProps {
  route: HashRoute;
  mode: 'live' | 'sample';
  theme: ThemeMode;
  onToggleTheme: () => void;
  debouncedSearch: string;
  searchResetVersion: number;
  onDebouncedSearchChange: (q: string) => void;
  savedCount: number;
  readLaterCount: number;
  domainCounts: Map<string, number>;
  canInstall?: boolean;
  onInstall?: () => void;
  showIPhoneSafariHint?: boolean;
  showOfflineBanner?: boolean;
  offlineSavedAt?: string | null;
  onOpenVoice?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  route,
  mode,
  theme,
  onToggleTheme,
  debouncedSearch,
  searchResetVersion,
  onDebouncedSearchChange,
  savedCount,
  readLaterCount,
  domainCounts,
  canInstall = false,
  onInstall,
  showIPhoneSafariHint = false,
  showOfflineBanner = false,
  offlineSavedAt = null,
  onOpenVoice,
  children,
}: AppShellProps) {
  const [mobileDomainsOpen, setMobileDomainsOpen] = useState(false);
  const [iosHintDismissed, setIosHintDismissed] = useState(false);
  const mobileDomainsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileDomainsCloseRef = useRef<HTMLButtonElement | null>(null);

  const closeMobileDomains = useCallback(() => {
    setMobileDomainsOpen(false);
    window.requestAnimationFrame(() => {
      mobileDomainsTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!mobileDomainsOpen) return;

    window.requestAnimationFrame(() => {
      mobileDomainsCloseRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileDomains();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDomainsOpen, closeMobileDomains]);

  const isDashboard = route.page === 'dashboard';
  const isForYou = route.page === 'for-you';
  const isSources = route.page === 'sources';
  const isSaved = route.page === 'saved';
  const isReadLater = route.page === 'read-later';
  const activeDomainSlug = route.page === 'domain' ? route.domainSlug : null;

  return (
    <div className="min-h-screen flex min-w-0 overflow-x-clip bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9]">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-[#1b4dff] focus:text-white dark:focus:bg-[#4d7cff] dark:focus:text-[#0b0f1a] focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Full Sidebar (>= 1024px) */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#0e1424]"
      >
        <div className="h-16 px-5 flex items-center border-b border-[#7c8899] dark:border-[#5a667a] shrink-0">
          <a
            href="#/"
            className="flex items-center gap-2.5 font-heading font-bold text-lg tracking-tight text-[#0f172a] dark:text-[#f1f5f9] whitespace-nowrap"
          >
            <Radar
              className="w-5 h-5 text-[#1b4dff] dark:text-[#4d7cff] shrink-0"
              aria-hidden="true"
            />
            <span>STEM Radar</span>
          </a>
        </div>

        <nav
          aria-label="Main sections"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
        >
          <div className="space-y-1">
            <a
              href="#/"
              aria-current={isDashboard ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                isDashboard
                  ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                  : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              )}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Dashboard</span>
            </a>

            <a
              href="#/for-you"
              aria-current={isForYou ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                isForYou
                  ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                  : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              )}
            >
              <Rss className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>For you</span>
            </a>

            <a
              href="#/sources"
              aria-current={isSources ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                isSources
                  ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                  : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              )}
            >
              <Server className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Sources</span>
            </a>

            <a
              href="#/saved"
              aria-current={isSaved ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                isSaved
                  ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                  : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              )}
            >
              <span className="flex items-center gap-3">
                <Bookmark className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Saved</span>
              </span>
              <span className="font-mono tabular-nums text-xs opacity-80">
                {savedCount}
              </span>
            </a>

            <a
              href="#/read-later"
              aria-current={isReadLater ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                isReadLater
                  ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                  : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
              )}
            >
              <span className="flex items-center gap-3">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Read Later</span>
              </span>
              <span className="font-mono tabular-nums text-xs opacity-80">
                {readLaterCount}
              </span>
            </a>
          </div>

          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
              Domains
            </div>
            <div className="space-y-0.5">
              {DOMAINS.map((domain) => {
                const isActive = activeDomainSlug === domain.slug;
                const count = domainCounts.get(domain.slug) ?? 0;
                return (
                  <a
                    key={domain.slug}
                    href={`#/domain/${encodeURIComponent(domain.slug)}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                        : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <span className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-1 shrink-0">
                        <DomainDot color={domain.color} size="sm" />
                      </span>
                      <span className="leading-snug">{domain.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] opacity-85 shrink-0">
                      {count}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>

      {/* Icon-Only Sidebar (768px - 1023px) */}
      <aside
        aria-label="Compact navigation"
        className="hidden md:flex lg:hidden md:flex-col md:w-[76px] md:shrink-0 md:sticky md:top-0 md:h-screen items-center border-r border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#0e1424]"
      >
        <div className="h-16 w-full flex items-center justify-center border-b border-[#7c8899] dark:border-[#5a667a] shrink-0">
          <a
            href="#/"
            aria-label="STEM Radar Home"
            title="STEM Radar"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#1b4dff] dark:text-[#4d7cff]"
          >
            <Radar className="w-6 h-6" aria-hidden="true" />
          </a>
        </div>

        <nav
          aria-label="Compact main sections"
          className="flex-1 overflow-y-auto py-4 flex flex-col items-center gap-2 w-full px-2"
        >
          <a
            href="#/"
            aria-label="Dashboard"
            title="Dashboard"
            aria-current={isDashboard ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
              isDashboard
                ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
          >
            <LayoutGrid className="w-5 h-5" aria-hidden="true" />
          </a>

          <a
            href="#/for-you"
            aria-label="For you"
            title="For you"
            aria-current={isForYou ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
              isForYou
                ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
          >
            <Rss className="w-5 h-5" aria-hidden="true" />
          </a>

          <a
            href="#/sources"
            aria-label="Sources"
            title="Sources"
            aria-current={isSources ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
              isSources
                ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
          >
            <Server className="w-5 h-5" aria-hidden="true" />
          </a>

          <a
            href="#/saved"
            aria-label={`Saved (${savedCount})`}
            title={`Saved (${savedCount})`}
            aria-current={isSaved ? 'page' : undefined}
            className={cn(
              'relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
              isSaved
                ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
          >
            <Bookmark className="w-5 h-5" aria-hidden="true" />
          </a>

          <a
            href="#/read-later"
            aria-label={`Read Later (${readLaterCount})`}
            title={`Read Later (${readLaterCount})`}
            aria-current={isReadLater ? 'page' : undefined}
            className={cn(
              'relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
              isReadLater
                ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
          >
            <Clock className="w-5 h-5" aria-hidden="true" />
          </a>

          <div
            className="w-8 h-px bg-[#7c8899] dark:bg-[#5a667a] my-1"
            aria-hidden="true"
          />

          {DOMAINS.map((domain) => {
            const isActive = activeDomainSlug === domain.slug;
            return (
              <a
                key={domain.slug}
                href={`#/domain/${encodeURIComponent(domain.slug)}`}
                aria-label={domain.name}
                title={domain.name}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
                  isActive
                    ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 ring-1 ring-[#1b4dff] dark:ring-[#7da1ff]'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                )}
              >
                <DomainDot color={domain.color} size="lg" />
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="border-b border-[#7c8899] dark:border-[#5a667a] bg-white/95 dark:bg-[#0e1424]/95 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
            {/* Mobile Brand */}
            <a
              href="#/"
              className="order-1 md:hidden flex items-center gap-2 min-h-[44px] font-heading font-bold text-base tracking-tight text-[#0f172a] dark:text-[#f1f5f9] whitespace-nowrap shrink-0"
            >
              <Radar
                className="w-5 h-5 text-[#1b4dff] dark:text-[#4d7cff] shrink-0"
                aria-hidden="true"
              />
              <span>STEM Radar</span>
            </a>

            {/* Search Input (debounced inside GlobalSearchInput) */}
            <GlobalSearchInput
              key={searchResetVersion}
              initialValue={debouncedSearch}
              onDebouncedSearchChange={onDebouncedSearchChange}
            />

            {/* Right Controls: Voice + Install Button (when offered) + Data Mode Pill + Theme Toggle */}
            <div className="order-2 sm:order-3 flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={onOpenVoice}
                  aria-label="Open voice conversation"
                  title="Voice conversation"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:px-3 py-2 rounded-lg text-xs font-semibold border border-[#1b4dff]/60 dark:border-[#7da1ff]/60 bg-[#1b4dff]/8 dark:bg-[#4d7cff]/12 text-[#1b4dff] dark:text-[#7da1ff] hover:bg-[#1b4dff]/15 dark:hover:bg-[#4d7cff]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <AudioLines className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Voice</span>
                </button>
              )}

              {canInstall && onInstall && (
                <button
                  type="button"
                  onClick={onInstall}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Install</span>
                </button>
              )}

              <DataModePill mode={mode} />

              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={
                  theme === 'dark'
                    ? 'Switch to light theme'
                    : 'Switch to dark theme'
                }
                title={
                  theme === 'dark'
                    ? 'Switch to light theme'
                    : 'Switch to dark theme'
                }
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors cursor-pointer shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Offline / Cached Copy Banner */}
        {showOfflineBanner && (
          <div
            role="status"
            className="border-b border-amber-800/70 dark:border-amber-400/60 bg-amber-500/15 text-amber-950 dark:text-amber-200"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium">
              <div className="flex items-center gap-2.5">
                <WifiOff className="w-4 h-4 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
                <span>
                  You are offline. Showing the last copy saved on this device; links need a connection.
                </span>
              </div>
              {offlineSavedAt && (
                <span className="font-mono text-xs text-amber-900 dark:text-amber-300">
                  {formatRelativeSavedTime(offlineSavedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* iPhone Safari Install Hint */}
        {showIPhoneSafariHint && !iosHintDismissed && (
          <div
            role="note"
            className="border-b border-[#7c8899] dark:border-[#5a667a] bg-[#1b4dff]/5 dark:bg-[#4d7cff]/10"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#0f172a] dark:text-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <Share
                  className="w-4 h-4 shrink-0 text-[#1b4dff] dark:text-[#7da1ff]"
                  aria-hidden="true"
                />
                <span>Tap Share, then Add to Home Screen</span>
              </div>
              <button
                type="button"
                onClick={() => setIosHintDismissed(true)}
                aria-label="Dismiss install hint"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-8 md:pb-10 focus:outline-none"
        >
          {children}
        </main>

        {/* Footer Link Row */}
        <footer className="border-t border-[#7c8899]/60 dark:border-[#5a667a]/70 bg-white/70 dark:bg-[#0e1424]/70">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 md:pb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569] dark:text-[#94a3b8]">
            <span>STEM Radar</span>
            <nav
              aria-label="Site information"
              className="flex flex-wrap items-center gap-x-5 gap-y-1"
            >
              <a
                href="#/about"
                aria-current={route.page === 'about' ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center min-h-[44px] transition-colors',
                  route.page === 'about'
                    ? 'text-[#1b4dff] dark:text-[#7da1ff] font-medium'
                    : 'hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
                )}
              >
                About
              </a>
              <a
                href="#/method"
                aria-current={route.page === 'method' ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center min-h-[44px] transition-colors',
                  route.page === 'method'
                    ? 'text-[#1b4dff] dark:text-[#7da1ff] font-medium'
                    : 'hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
                )}
              >
                How it works
              </a>
              <a
                href="#/privacy"
                aria-current={route.page === 'privacy' ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center min-h-[44px] transition-colors',
                  route.page === 'privacy'
                    ? 'text-[#1b4dff] dark:text-[#7da1ff] font-medium'
                    : 'hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
                )}
              >
                Privacy
              </a>
              <a
                href="#/contact"
                aria-current={route.page === 'contact' ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center min-h-[44px] transition-colors',
                  route.page === 'contact'
                    ? 'text-[#1b4dff] dark:text-[#7da1ff] font-medium'
                    : 'hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
                )}
              >
                Contact / takedown
              </a>
            </nav>
          </div>
        </footer>
      </div>

      {/* Mobile Domains Drawer (< 768px) */}
      {mobileDomainsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Browse STEM Domains"
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs"
          onClick={closeMobileDomains}
        >
          <div
            className="bg-white dark:bg-[#111827] border-t border-[#7c8899] dark:border-[#5a667a] rounded-t-2xl p-4 pb-6 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-heading font-semibold text-base text-[#0f172a] dark:text-[#f1f5f9]">
                STEM Domains
              </h2>
              <button
                ref={mobileDomainsCloseRef}
                type="button"
                onClick={closeMobileDomains}
                aria-label="Close domains menu"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#475569] dark:text-[#94a3b8]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-1">
              {DOMAINS.map((domain) => {
                const isActive = activeDomainSlug === domain.slug;
                const count = domainCounts.get(domain.slug) ?? 0;
                return (
                  <a
                    key={domain.slug}
                    href={`#/domain/${encodeURIComponent(domain.slug)}`}
                    onClick={closeMobileDomains}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#7da1ff]'
                        : 'text-[#0f172a] dark:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <DomainDot color={domain.color} size="md" />
                      <span className="leading-snug">{domain.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8]">
                      {count}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[60px] border-t border-[#7c8899] dark:border-[#5a667a] bg-white/95 dark:bg-[#0e1424]/95 backdrop-blur-md grid grid-cols-6 items-center px-0.5"
      >
        <a
          href="#/"
          aria-current={isDashboard ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors px-0.5',
            isDashboard
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <LayoutGrid className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">Dashboard</span>
        </a>

        <a
          href="#/for-you"
          aria-current={isForYou ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors px-0.5',
            isForYou
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <Rss className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">For you</span>
        </a>

        <button
          ref={mobileDomainsTriggerRef}
          type="button"
          onClick={() =>
            mobileDomainsOpen
              ? closeMobileDomains()
              : setMobileDomainsOpen(true)
          }
          aria-expanded={mobileDomainsOpen}
          aria-current={activeDomainSlug ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors cursor-pointer px-0.5',
            activeDomainSlug || mobileDomainsOpen
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <Compass className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">Domains</span>
        </button>

        <a
          href="#/sources"
          aria-current={isSources ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors px-0.5',
            isSources
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <Server className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">Sources</span>
        </a>

        <a
          href="#/saved"
          aria-label={`Saved (${savedCount})`}
          title={`Saved (${savedCount})`}
          aria-current={isSaved ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors px-0.5',
            isSaved
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <Bookmark className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">Saved ({savedCount})</span>
        </a>

        <a
          href="#/read-later"
          aria-label={`Read Later (${readLaterCount})`}
          title={`Read Later (${readLaterCount})`}
          aria-current={isReadLater ? 'page' : undefined}
          className={cn(
            'min-w-0 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors px-0.5',
            isReadLater
              ? 'text-[#1b4dff] dark:text-[#7da1ff]'
              : 'text-[#475569] dark:text-[#94a3b8]'
          )}
        >
          <Clock className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full">Read Later</span>
        </a>
      </nav>
    </div>
  );
}
