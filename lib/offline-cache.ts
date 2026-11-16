import type { Discovery, MonitoredSource } from './types';

const OFFLINE_SNAPSHOT_KEY = 'stem-radar-offline-snapshot';

export interface OfflineSnapshot {
  discoveries: Discovery[];
  sources: MonitoredSource[];
  domainCounts?: Record<string, number>;
  savedAt: string;
}

export function saveOfflineSnapshot(
  discoveries: Discovery[],
  sources: MonitoredSource[],
  domainCounts?: Record<string, number>
): string {
  const savedAt = new Date().toISOString();
  if (typeof window === 'undefined') return savedAt;
  try {
    const existing = loadOfflineSnapshot();
    // Merge newly loaded discoveries by slug so paginated loads enrich the offline cache
    const mergedMap = new Map<string, Discovery>();
    if (existing) {
      for (const item of existing.discoveries) {
        mergedMap.set(item.slug, item);
      }
    }
    for (const item of discoveries) {
      mergedMap.set(item.slug, item);
    }
    const payload: OfflineSnapshot = {
      discoveries: Array.from(mergedMap.values()),
      sources: sources.length > 0 ? sources : (existing?.sources ?? []),
      domainCounts: domainCounts ?? existing?.domainCounts,
      savedAt,
    };
    window.localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
  return savedAt;
}

export function loadOfflineSnapshot(): OfflineSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineSnapshot>;
    if (
      !parsed ||
      !Array.isArray(parsed.discoveries) ||
      !Array.isArray(parsed.sources)
    ) {
      return null;
    }
    return {
      discoveries: parsed.discoveries,
      sources: parsed.sources,
      domainCounts: parsed.domainCounts,
      savedAt:
        typeof parsed.savedAt === 'string'
          ? parsed.savedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
