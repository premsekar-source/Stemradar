import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DOMAINS, type Discovery, type DomainInfo } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Only permit http: or https: URLs for external rendering.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown date';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/**
 * If published_at is null, show "Found <date>" instead of a publication date.
 */
export function formatDiscoveryDate(
  publishedAt: string | null | undefined,
  discoveredAt: string
): { label: string; isFoundFallback: boolean } {
  if (!publishedAt) {
    return {
      label: `Found ${formatDate(discoveredAt)}`,
      isFoundFallback: true,
    };
  }
  return {
    label: formatDate(publishedAt),
    isFoundFallback: false,
  };
}

/**
 * Sort key: use published_at if known, otherwise fall back to discovered_at
 * so items with a null publication date are never buried.
 */
export function getEffectiveTimestamp(item: Discovery): number {
  const dateStr = item.published_at || item.discovered_at;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function sortDiscoveries(
  items: Discovery[],
  sortBy: 'newest' | 'significant' = 'newest'
): Discovery[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'significant' && a.significant !== b.significant) {
      return a.significant ? -1 : 1;
    }
    return getEffectiveTimestamp(b) - getEffectiveTimestamp(a);
  });
}

export function formatRelativeSavedTime(
  savedAt: string | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!savedAt) return 'Saved recently';
  const savedMs = new Date(savedAt).getTime();
  if (Number.isNaN(savedMs)) return 'Saved recently';

  const diffSeconds = Math.max(0, Math.floor((nowMs - savedMs) / 1000));
  if (diffSeconds < 60) return 'Saved just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Saved ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Saved ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Saved ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

export function formatLinkCheckedTime(
  lastVerifiedAt: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!lastVerifiedAt) return null;
  const verifiedMs = new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedMs)) return null;

  const diffSeconds = Math.max(0, Math.floor((nowMs - verifiedMs) / 1000));
  if (diffSeconds < 60) return 'Link checked just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Link checked ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Link checked ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Link checked ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

export function estimateReadingTime(text: string | null | undefined): string {
  const words = (text ?? '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export type FeedDateGroupLabel = 'Today' | 'This week' | 'Earlier';

export interface FeedDateGroup {
  label: FeedDateGroupLabel;
  items: Discovery[];
}

/**
 * Group discoveries by local calendar day:
 * - Today: same local calendar day (or later)
 * - This week: the previous 6 local calendar days
 * - Earlier: older or invalid/missing dates
 * Uses published_at when known, otherwise discovered_at.
 * Empty groups are omitted, and existing sort order is preserved inside each group.
 */
export function groupDiscoveriesByDate(
  items: Discovery[],
  sortBy: 'newest' | 'significant' = 'newest',
  now: Date = new Date()
): FeedDateGroup[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfThisWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6
  ).getTime();

  const todayItems: Discovery[] = [];
  const thisWeekItems: Discovery[] = [];
  const earlierItems: Discovery[] = [];

  for (const item of items) {
    const rawDate = item.published_at || item.discovered_at;
    const parsed = rawDate ? new Date(rawDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      earlierItems.push(item);
      continue;
    }
    const itemDayStart = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    ).getTime();

    if (itemDayStart >= startOfToday) {
      todayItems.push(item);
    } else if (itemDayStart >= startOfThisWeek) {
      thisWeekItems.push(item);
    } else {
      earlierItems.push(item);
    }
  }

  const groups: FeedDateGroup[] = [
    { label: 'Today', items: sortDiscoveries(todayItems, sortBy) },
    { label: 'This week', items: sortDiscoveries(thisWeekItems, sortBy) },
    { label: 'Earlier', items: sortDiscoveries(earlierItems, sortBy) },
  ];

  return groups.filter((group) => group.items.length > 0);
}

export function isDiscoveredInLast7Days(
  discoveredAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!discoveredAt) return false;
  const ts = new Date(discoveredAt).getTime();
  if (Number.isNaN(ts)) return false;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return ts >= nowMs - sevenDaysMs;
}

export function getDomainBySlug(slug: string): DomainInfo | undefined {
  return DOMAINS.find((d) => d.slug === slug);
}

export function getDomainByName(name: string): DomainInfo | undefined {
  const normalized = name.trim().toLowerCase();
  return DOMAINS.find(
    (d) =>
      d.name.toLowerCase() === normalized ||
      d.slug.toLowerCase() === normalized ||
      d.shortName.toLowerCase() === normalized
  );
}
