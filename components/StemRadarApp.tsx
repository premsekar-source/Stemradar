'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { DOMAINS } from '@/data/domains';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '@/lib/offline-cache';
import {
  createRadarService,
  DISCOVERIES_PAGE_SIZE,
  filterAndPaginateLocalDiscoveries,
  hasSupabaseEnvVars,
} from '@/lib/radar-service';
import type { Discovery, MonitoredSource, SortOrder } from '@/lib/types';
import {
  getDomainByName,
  isDiscoveredInLast7Days,
  sortDiscoveries,
} from '@/lib/utils';
import { useFollows } from '@/hooks/use-follows';
import { useHashRoute } from '@/hooks/use-hash-route';
import { usePreviousVisit } from '@/hooks/use-last-visit';
import { useOnlineStatus, usePWAInstall } from '@/hooks/use-pwa';
import {
  DEFAULT_COLLECTION_ID,
  SavedCollectionsProvider,
  useSavedItems,
} from '@/hooks/use-saved-items';
import { useTheme } from '@/hooks/use-theme';
import { AppShell } from './AppShell';
import { LiveVoiceModal, type VoiceTopicContext } from './LiveVoiceModal';
import {
  DashboardSkeleton,
  DetailSkeleton,
  SourcesSkeleton,
} from './SkeletonStates';
import { EmptyState, ErrorState } from './StateViews';

const DashboardView = dynamic(
  () => import('./DashboardView').then((m) => m.DashboardView),
  { loading: () => <DashboardSkeleton /> }
);
const DomainView = dynamic(
  () => import('./DomainView').then((m) => m.DomainView),
  { loading: () => <DashboardSkeleton /> }
);
const ForYouView = dynamic(
  () => import('./ForYouView').then((m) => m.ForYouView),
  { loading: () => <DashboardSkeleton /> }
);
const ItemView = dynamic(
  () => import('./ItemView').then((m) => m.ItemView),
  { loading: () => <DetailSkeleton /> }
);
const SourcesView = dynamic(
  () => import('./SourcesView').then((m) => m.SourcesView),
  { loading: () => <SourcesSkeleton /> }
);
const SavedView = dynamic(
  () => import('./SavedView').then((m) => m.SavedView),
  { loading: () => <DashboardSkeleton /> }
);
const AboutView = dynamic(
  () => import('./InfoPages').then((m) => m.AboutView),
  { loading: () => <DetailSkeleton /> }
);
const MethodView = dynamic(
  () => import('./InfoPages').then((m) => m.MethodView),
  { loading: () => <DetailSkeleton /> }
);
const PrivacyView = dynamic(
  () => import('./InfoPages').then((m) => m.PrivacyView),
  { loading: () => <DetailSkeleton /> }
);
const ContactView = dynamic(
  () => import('./InfoPages').then((m) => m.ContactView),
  { loading: () => <DetailSkeleton /> }
);

function countDiscoveryTypes(items: readonly Discovery[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.type.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function StemRadarApp() {
  const service = useMemo(() => createRadarService(), []);
  const { route } = useHashRoute();
  const savedCollectionsState = useSavedItems();
  const {
    collections,
    savedSlugs,
    readLaterCollectionId,
    readLaterSlugs,
    storageUnavailable: savedStorageUnavailable,
    isSaved,
    toggleSaved,
    removeFromCollection,
    moveInCollection,
    clearCollection,
    createCollection,
    renameCollection,
    deleteCollection,
    pendingUndo,
    undoLastRemoval,
    dismissUndo,
  } = savedCollectionsState;
  const {
    followedDomains,
    followedKeywords,
    storageUnavailable: followStorageUnavailable,
    isFollowingDomain,
    toggleFollowDomain,
    addKeyword,
    removeKeyword,
  } = useFollows();
  const { theme, toggleTheme } = useTheme();
  const { isNewSincePreviousVisit } = usePreviousVisit();
  const isOnline = useOnlineStatus();
  const { canInstall, showIPhoneSafariHint, install } = usePWAInstall();

  // Filter / query state (search is debounced 200ms inside AppShell's GlobalSearchInput)
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [searchResetVersion, setSearchResetVersion] = useState<number>(0);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOrder>('newest');
  const [savedTabId, setSavedTabId] = useState<string>(DEFAULT_COLLECTION_ID);
  const [voiceOpen, setVoiceOpen] = useState<boolean>(false);
  const [voiceTopic, setVoiceTopic] = useState<VoiceTopicContext | null>(null);

  // Data state
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [typePool, setTypePool] = useState<{ key: string; items: Discovery[] }>({
    key: '',
    items: [],
  });
  const typePoolKeyRef = useRef<string>('');
  const [featuredItem, setFeaturedItem] = useState<Discovery | null>(null);
  const [deepLinkItem, setDeepLinkItem] = useState<Discovery | null>(null);
  const [sources, setSources] = useState<MonitoredSource[]>([]);
  const [domainCountsRecord, setDomainCountsRecord] = useState<
    Record<string, number>
  >({});
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Loading & offline state
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingSavedOfflineCopy, setUsingSavedOfflineCopy] =
    useState<boolean>(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);

  const activeDomainFilter =
    route.page === 'domain' ? route.domainSlug : selectedDomain;
  const scopeKey = `${activeDomainFilter}::${debouncedSearch}`;

  // Initial load: sources, domain counts, and first page of discoveries
  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const snapshot = loadOfflineSnapshot();
        if (snapshot) {
          if (!active) return;
          const page = filterAndPaginateLocalDiscoveries(snapshot.discoveries, {
            limit: DISCOVERIES_PAGE_SIZE,
            offset: 0,
            sort: 'newest',
          });
          setDiscoveries(page.items);
          typePoolKeyRef.current = 'all::';
          setTypePool({ key: 'all::', items: page.items });
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
          setSources(snapshot.sources);
          setDomainCountsRecord(snapshot.domainCounts ?? {});
          const best = sortDiscoveries(snapshot.discoveries, 'significant')[0] ?? null;
          setFeaturedItem(best);
          setUsingSavedOfflineCopy(true);
          setOfflineSavedAt(snapshot.savedAt);
          setError(null);
          setInitialLoading(false);
          return;
        }
      }

      try {
        const [page, sourcesResult, countsResult, featuredPage] =
          await Promise.all([
            service.listDiscoveries({
              limit: DISCOVERIES_PAGE_SIZE,
              offset: 0,
              sort: 'newest',
            }),
            service.listSources(),
            service.listDomainCounts(),
            service.listDiscoveries({
              limit: 5,
              offset: 0,
              sort: 'significant',
            }),
          ]);

        if (!active) return;
        const savedAt = saveOfflineSnapshot(
          [...page.items, ...featuredPage.items],
          sourcesResult,
          countsResult
        );
        setDiscoveries(page.items);
        typePoolKeyRef.current = 'all::';
        setTypePool({ key: 'all::', items: page.items });
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
        setSources(sourcesResult);
        setDomainCountsRecord(countsResult);
        setFeaturedItem(
          sortDiscoveries(featuredPage.items, 'significant')[0] ??
            page.items[0] ??
            null
        );
        setUsingSavedOfflineCopy(false);
        setOfflineSavedAt(savedAt);
        setError(null);
        setInitialLoading(false);
      } catch (err) {
        if (!active) return;
        const snapshot = loadOfflineSnapshot();
        if (snapshot) {
          const page = filterAndPaginateLocalDiscoveries(snapshot.discoveries, {
            limit: DISCOVERIES_PAGE_SIZE,
            offset: 0,
            sort: 'newest',
          });
          setDiscoveries(page.items);
          typePoolKeyRef.current = 'all::';
          setTypePool({ key: 'all::', items: page.items });
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
          setSources(snapshot.sources);
          setDomainCountsRecord(snapshot.domainCounts ?? {});
          setFeaturedItem(
            sortDiscoveries(snapshot.discoveries, 'significant')[0] ?? null
          );
          setUsingSavedOfflineCopy(true);
          setOfflineSavedAt(snapshot.savedAt);
          setError(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while fetching STEM Radar data.'
          );
        }
        setInitialLoading(false);
      }
    };

    void loadInitial();

    return () => {
      active = false;
    };
  }, [service]);

  const serviceTypeParam =
    selectedTypes.length === 1 ? selectedTypes[0] : 'all';

  // Query service whenever search, domain filter, type filter, or sort changes
  useEffect(() => {
    if (initialLoading) return;
    let active = true;

    const queryOptions = {
      domain: activeDomainFilter,
      type: serviceTypeParam,
      search: debouncedSearch,
      sort: sortBy,
      limit: DISCOVERIES_PAGE_SIZE,
      offset: 0,
    };

    const needsTypePoolRefresh =
      serviceTypeParam !== 'all' && typePoolKeyRef.current !== scopeKey;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const snapshot = loadOfflineSnapshot();
      if (snapshot) {
        const page = filterAndPaginateLocalDiscoveries(
          snapshot.discoveries,
          queryOptions
        );
        const poolPage =
          serviceTypeParam === 'all'
            ? page
            : needsTypePoolRefresh
              ? filterAndPaginateLocalDiscoveries(snapshot.discoveries, {
                  ...queryOptions,
                  type: 'all',
                })
              : null;

        Promise.resolve().then(() => {
          if (!active) return;
          setDiscoveries(page.items);
          if (poolPage) {
            typePoolKeyRef.current = scopeKey;
            setTypePool({ key: scopeKey, items: poolPage.items });
          }
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
          setUsingSavedOfflineCopy(true);
          setOfflineSavedAt(snapshot.savedAt);
        });
      }
      return () => {
        active = false;
      };
    }

    const runQuery = async () => {
      try {
        const [page, poolPage] = await Promise.all([
          service.listDiscoveries(queryOptions),
          needsTypePoolRefresh
            ? service.listDiscoveries({ ...queryOptions, type: 'all' })
            : Promise.resolve(null),
        ]);

        if (!active) return;
        const savedAt = saveOfflineSnapshot(page.items, []);
        setDiscoveries(page.items);
        if (serviceTypeParam === 'all') {
          typePoolKeyRef.current = scopeKey;
          setTypePool({ key: scopeKey, items: page.items });
        } else if (poolPage) {
          typePoolKeyRef.current = scopeKey;
          setTypePool({ key: scopeKey, items: poolPage.items });
        }
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
        setUsingSavedOfflineCopy(false);
        setOfflineSavedAt(savedAt);
        setError(null);
      } catch (err) {
        if (!active) return;
        const snapshot = loadOfflineSnapshot();
        if (snapshot) {
          const page = filterAndPaginateLocalDiscoveries(
            snapshot.discoveries,
            queryOptions
          );
          setDiscoveries(page.items);
          if (serviceTypeParam === 'all') {
            typePoolKeyRef.current = scopeKey;
            setTypePool({ key: scopeKey, items: page.items });
          } else if (needsTypePoolRefresh) {
            const poolPage = filterAndPaginateLocalDiscoveries(
              snapshot.discoveries,
              { ...queryOptions, type: 'all' }
            );
            typePoolKeyRef.current = scopeKey;
            setTypePool({ key: scopeKey, items: poolPage.items });
          }
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
          setUsingSavedOfflineCopy(true);
          setOfflineSavedAt(snapshot.savedAt);
          setError(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to filter discoveries.'
          );
        }
      }
    };

    void runQuery();

    return () => {
      active = false;
    };
  }, [
    initialLoading,
    service,
    activeDomainFilter,
    serviceTypeParam,
    debouncedSearch,
    sortBy,
    scopeKey,
  ]);

  // Deep-link item lookup if item isn't in the currently loaded page
  const itemRouteSlug = route.page === 'item' ? route.itemSlug : null;
  useEffect(() => {
    if (!itemRouteSlug) return;
    if (discoveries.some((d) => d.slug === itemRouteSlug)) return;

    let active = true;
    service
      .getDiscoveryBySlug(itemRouteSlug)
      .then((found) => {
        if (!active || !found) return;
        setDeepLinkItem(found);
        saveOfflineSnapshot([found], []);
      })
      .catch(() => {
        const snapshot = loadOfflineSnapshot();
        const found = snapshot?.discoveries.find(
          (d) => d.slug === itemRouteSlug
        );
        if (active && found) {
          setDeepLinkItem(found);
        }
      });

    return () => {
      active = false;
    };
  }, [itemRouteSlug, discoveries, service]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const queryOptions = {
      domain: activeDomainFilter,
      type: serviceTypeParam,
      search: debouncedSearch,
      sort: sortBy,
      limit: DISCOVERIES_PAGE_SIZE,
      offset: discoveries.length,
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const snapshot = loadOfflineSnapshot();
        if (snapshot) {
          const page = filterAndPaginateLocalDiscoveries(
            snapshot.discoveries,
            queryOptions
          );
          setDiscoveries((prev) => [...prev, ...page.items]);
          if (serviceTypeParam === 'all') {
            setTypePool((prev) => ({
              key: scopeKey,
              items: [...prev.items, ...page.items],
            }));
          }
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
          setUsingSavedOfflineCopy(true);
          setOfflineSavedAt(snapshot.savedAt);
        }
        return;
      }

      const page = await service.listDiscoveries(queryOptions);
      const savedAt = saveOfflineSnapshot(page.items, []);
      setDiscoveries((prev) => {
        const existingSlugs = new Set(prev.map((d) => d.slug));
        const uniqueNext = page.items.filter((d) => !existingSlugs.has(d.slug));
        return [...prev, ...uniqueNext];
      });
      if (serviceTypeParam === 'all') {
        setTypePool((prev) => {
          const existing = new Set(prev.items.map((d) => d.slug));
          const uniqueNext = page.items.filter((d) => !existing.has(d.slug));
          return { key: scopeKey, items: [...prev.items, ...uniqueNext] };
        });
      }
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
      setOfflineSavedAt(savedAt);
    } catch {
      const snapshot = loadOfflineSnapshot();
      if (snapshot) {
        const page = filterAndPaginateLocalDiscoveries(
          snapshot.discoveries,
          queryOptions
        );
        setDiscoveries((prev) => [...prev, ...page.items]);
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
        setUsingSavedOfflineCopy(true);
        setOfflineSavedAt(snapshot.savedAt);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasMore,
    activeDomainFilter,
    serviceTypeParam,
    debouncedSearch,
    sortBy,
    discoveries.length,
    service,
    scopeKey,
  ]);

  const handleRetry = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const [page, sourcesResult, countsResult, poolPage] = await Promise.all([
        service.listDiscoveries({
          domain: activeDomainFilter,
          type: serviceTypeParam,
          search: debouncedSearch,
          sort: sortBy,
          limit: DISCOVERIES_PAGE_SIZE,
          offset: 0,
        }),
        service.listSources(),
        service.listDomainCounts(),
        serviceTypeParam === 'all'
          ? Promise.resolve(null)
          : service.listDiscoveries({
              domain: activeDomainFilter,
              type: 'all',
              search: debouncedSearch,
              sort: sortBy,
              limit: DISCOVERIES_PAGE_SIZE,
              offset: 0,
            }),
      ]);
      const savedAt = saveOfflineSnapshot(
        page.items,
        sourcesResult,
        countsResult
      );
      setDiscoveries(page.items);
      typePoolKeyRef.current = scopeKey;
      setTypePool({
        key: scopeKey,
        items: poolPage ? poolPage.items : page.items,
      });
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
      setSources(sourcesResult);
      setDomainCountsRecord(countsResult);
      setUsingSavedOfflineCopy(false);
      setOfflineSavedAt(savedAt);
    } catch (err) {
      const snapshot = loadOfflineSnapshot();
      if (snapshot) {
        const page = filterAndPaginateLocalDiscoveries(snapshot.discoveries, {
          domain: activeDomainFilter,
          type: serviceTypeParam,
          search: debouncedSearch,
          sort: sortBy,
          limit: DISCOVERIES_PAGE_SIZE,
          offset: 0,
        });
        setDiscoveries(page.items);
        const poolPage =
          serviceTypeParam === 'all'
            ? page
            : filterAndPaginateLocalDiscoveries(snapshot.discoveries, {
                domain: activeDomainFilter,
                type: 'all',
                search: debouncedSearch,
                sort: sortBy,
                limit: DISCOVERIES_PAGE_SIZE,
                offset: 0,
              });
        typePoolKeyRef.current = scopeKey;
        setTypePool({ key: scopeKey, items: poolPage.items });
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
        setSources(snapshot.sources);
        setDomainCountsRecord(snapshot.domainCounts ?? {});
        setUsingSavedOfflineCopy(true);
        setOfflineSavedAt(snapshot.savedAt);
        setError(null);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while fetching STEM Radar data.'
        );
      }
    } finally {
      setInitialLoading(false);
    }
  }, [
    service,
    activeDomainFilter,
    serviceTypeParam,
    debouncedSearch,
    sortBy,
    scopeKey,
  ]);

  // Refresh automatically when connection returns after serving offline copy
  useEffect(() => {
    if (!isOnline || !usingSavedOfflineCopy) return;
    let active = true;
    Promise.all([
      service.listDiscoveries({
        domain: activeDomainFilter,
        type: serviceTypeParam,
        search: debouncedSearch,
        sort: sortBy,
        limit: DISCOVERIES_PAGE_SIZE,
        offset: 0,
      }),
      service.listSources(),
      service.listDomainCounts(),
      serviceTypeParam === 'all'
        ? Promise.resolve(null)
        : service.listDiscoveries({
            domain: activeDomainFilter,
            type: 'all',
            search: debouncedSearch,
            sort: sortBy,
            limit: DISCOVERIES_PAGE_SIZE,
            offset: 0,
          }),
    ])
      .then(([page, sourcesResult, countsResult, poolPage]) => {
        if (!active) return;
        const savedAt = saveOfflineSnapshot(
          page.items,
          sourcesResult,
          countsResult
        );
        setDiscoveries(page.items);
        typePoolKeyRef.current = scopeKey;
        setTypePool({
          key: scopeKey,
          items: poolPage ? poolPage.items : page.items,
        });
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
        setSources(sourcesResult);
        setDomainCountsRecord(countsResult);
        setUsingSavedOfflineCopy(false);
        setOfflineSavedAt(savedAt);
        setError(null);
      })
      .catch(() => {
        // Keep serving offline copy if refresh fails
      });
    return () => {
      active = false;
    };
  }, [
    isOnline,
    usingSavedOfflineCopy,
    service,
    activeDomainFilter,
    serviceTypeParam,
    debouncedSearch,
    sortBy,
    scopeKey,
  ]);

  const visibleDiscoveries = useMemo(() => {
    if (selectedTypes.length <= 1) return discoveries;
    const allowed = new Set(selectedTypes.map((t) => t.trim().toLowerCase()));
    return discoveries.filter((item) =>
      allowed.has(item.type.trim().toLowerCase())
    );
  }, [discoveries, selectedTypes]);

  const typeCounts = useMemo(
    () => countDiscoveryTypes(typePool.items),
    [typePool.items]
  );

  const domainCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of DOMAINS) {
      map.set(d.slug, domainCountsRecord[d.slug] ?? 0);
    }
    const hasNonZero = Array.from(map.values()).some((v) => v > 0);
    if (!hasNonZero && discoveries.length > 0) {
      for (const item of discoveries) {
        const info = getDomainByName(item.domain);
        if (info) {
          map.set(info.slug, (map.get(info.slug) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [domainCountsRecord, discoveries]);

  // Combine loaded discoveries with deep-linked or cached saved items for SavedView, ItemView & 7-day counts
  const allKnownDiscoveries = useMemo(() => {
    const map = new Map<string, Discovery>();
    const snapshot = loadOfflineSnapshot();
    if (snapshot) {
      for (const d of snapshot.discoveries) map.set(d.slug, d);
    }
    if (featuredItem) map.set(featuredItem.slug, featuredItem);
    if (deepLinkItem) map.set(deepLinkItem.slug, deepLinkItem);
    for (const d of discoveries) map.set(d.slug, d);
    return Array.from(map.values());
  }, [discoveries, featuredItem, deepLinkItem]);

  const domainNewThisWeekCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of DOMAINS) {
      map.set(d.slug, 0);
    }
    for (const item of allKnownDiscoveries) {
      if (isDiscoveredInLast7Days(item.discovered_at)) {
        const info = getDomainByName(item.domain);
        if (info) {
          map.set(info.slug, (map.get(info.slug) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [allKnownDiscoveries]);

  const handleToggleType = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      const lower = type.toLowerCase();
      const exists = prev.some((t) => t.toLowerCase() === lower);
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== lower);
      }
      return [...prev, type];
    });
  }, []);

  const handleClearSearch = useCallback(() => {
    setDebouncedSearch('');
    setSearchResetVersion((v) => v + 1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedDomain('all');
    setSelectedTypes([]);
    setDebouncedSearch('');
    setSearchResetVersion((v) => v + 1);
  }, []);

  const showSampleBanner = !hasSupabaseEnvVars();

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={handleRetry} />;
    }

    if (initialLoading) {
      if (route.page === 'sources') return <SourcesSkeleton />;
      if (route.page === 'item') return <DetailSkeleton />;
      return <DashboardSkeleton />;
    }

    switch (route.page) {
      case 'dashboard':
        return (
          <DashboardView
            discoveries={visibleDiscoveries}
            featuredItem={featuredItem}
            domainCounts={domainCounts}
            domainNewThisWeekCounts={domainNewThisWeekCounts}
            typeCounts={typeCounts}
            totalCount={totalCount}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void handleLoadMore();
            }}
            showSampleBanner={showSampleBanner}
            searchQuery={debouncedSearch}
            selectedDomain={selectedDomain}
            onSelectDomain={setSelectedDomain}
            selectedTypes={selectedTypes}
            onToggleType={handleToggleType}
            sortBy={sortBy}
            onSortChange={setSortBy}
            isSaved={isSaved}
            isNewItem={isNewSincePreviousVisit}
            onToggleSave={toggleSaved}
            isFollowingDomain={isFollowingDomain}
            onToggleFollowDomain={toggleFollowDomain}
            storageUnavailable={followStorageUnavailable}
            onResetFilters={handleResetFilters}
          />
        );

      case 'for-you':
        return (
          <ForYouView
            discoveries={allKnownDiscoveries}
            followedDomains={followedDomains}
            followedKeywords={followedKeywords}
            storageUnavailable={followStorageUnavailable}
            onToggleFollowDomain={toggleFollowDomain}
            onAddKeyword={addKeyword}
            onRemoveKeyword={removeKeyword}
            isSaved={isSaved}
            isNewItem={isNewSincePreviousVisit}
            onToggleSave={toggleSaved}
          />
        );

      case 'domain':
        return (
          <DomainView
            domainSlug={route.domainSlug}
            discoveries={visibleDiscoveries}
            typeCounts={typeCounts}
            totalCount={totalCount}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void handleLoadMore();
            }}
            selectedTypes={selectedTypes}
            onToggleType={handleToggleType}
            sortBy={sortBy}
            onSortChange={setSortBy}
            isSaved={isSaved}
            isNewItem={isNewSincePreviousVisit}
            onToggleSave={toggleSaved}
            isFollowingDomain={isFollowingDomain}
            onToggleFollowDomain={toggleFollowDomain}
            storageUnavailable={followStorageUnavailable}
            onResetFilters={handleResetFilters}
          />
        );

      case 'item':
        return (
          <ItemView
            key={route.itemSlug}
            itemSlug={route.itemSlug}
            discoveries={allKnownDiscoveries}
            mode={service.mode}
            isSaved={isSaved}
            isNewItem={isNewSincePreviousVisit}
            onToggleSave={toggleSaved}
            onDiscussByVoice={(ctx) => {
              setVoiceTopic(ctx);
              setVoiceOpen(true);
            }}
          />
        );

      case 'sources':
        return (
          <SourcesView
            sources={sources}
            searchQuery={debouncedSearch}
            onClearSearch={handleClearSearch}
          />
        );

      case 'saved':
        return (
          <SavedView
            discoveries={allKnownDiscoveries}
            collections={collections}
            savedSlugs={savedSlugs}
            readLaterCollectionId={readLaterCollectionId}
            activeCollectionId={savedTabId}
            onSelectCollectionId={setSavedTabId}
            storageUnavailable={savedStorageUnavailable}
            searchQuery={debouncedSearch}
            isSaved={isSaved}
            onToggleSave={toggleSaved}
            onRemoveFromCollection={removeFromCollection}
            onMoveInCollection={moveInCollection}
            onClearCollection={clearCollection}
            onCreateCollection={createCollection}
            onRenameCollection={renameCollection}
            onDeleteCollection={deleteCollection}
            onClearSearch={handleClearSearch}
          />
        );

      case 'read-later':
        return (
          <SavedView
            discoveries={allKnownDiscoveries}
            collections={collections}
            savedSlugs={savedSlugs}
            readLaterCollectionId={readLaterCollectionId}
            activeCollectionId={readLaterCollectionId}
            onSelectCollectionId={(id) => {
              setSavedTabId(id);
              if (id !== readLaterCollectionId) {
                window.location.hash = '#/saved';
              }
            }}
            storageUnavailable={savedStorageUnavailable}
            searchQuery={debouncedSearch}
            isSaved={isSaved}
            onToggleSave={toggleSaved}
            onRemoveFromCollection={removeFromCollection}
            onMoveInCollection={moveInCollection}
            onClearCollection={clearCollection}
            onCreateCollection={createCollection}
            onRenameCollection={renameCollection}
            onDeleteCollection={deleteCollection}
            onClearSearch={handleClearSearch}
          />
        );

      case 'about':
        return <AboutView />;

      case 'method':
        return <MethodView />;

      case 'privacy':
        return <PrivacyView />;

      case 'contact':
        return (
          <ContactView
            reportTitle={route.reportTitle}
            reportUrl={route.reportUrl}
          />
        );

      case 'not-found':
      default:
        return (
          <EmptyState
            title="Page not found"
            description="The requested STEM Radar route does not exist."
            actionLabel="Go to Dashboard"
            actionHref="#/"
            headingAs="h1"
          />
        );
    }
  };

  const showOfflineBanner =
    usingSavedOfflineCopy ||
    (!isOnline && (discoveries.length > 0 || sources.length > 0));

  return (
    <MotionConfig reducedMotion="user">
      <SavedCollectionsProvider value={savedCollectionsState}>
        <AppShell
          route={route}
          mode={service.mode}
          theme={theme}
          onToggleTheme={toggleTheme}
          debouncedSearch={debouncedSearch}
          searchResetVersion={searchResetVersion}
          onDebouncedSearchChange={setDebouncedSearch}
          savedCount={savedSlugs.length}
          readLaterCount={readLaterSlugs.length}
          domainCounts={domainCounts}
          canInstall={canInstall}
          onInstall={() => {
            void install();
          }}
          showIPhoneSafariHint={showIPhoneSafariHint}
          showOfflineBanner={showOfflineBanner}
          offlineSavedAt={offlineSavedAt}
          onOpenVoice={() => {
            setVoiceTopic(null);
            setVoiceOpen(true);
          }}
        >
          {renderBody()}
        </AppShell>

      <LiveVoiceModal
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        topicContext={voiceTopic}
        onClearTopicContext={() => setVoiceTopic(null)}
      />

      {pendingUndo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[72px] md:bottom-5 right-4 left-4 sm:left-auto sm:max-w-md z-40 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] shadow-lg"
        >
          <p className="text-xs sm:text-sm min-w-0">
            Removed{' '}
            <span className="font-semibold break-words">
              &ldquo;{pendingUndo.label}&rdquo;
            </span>{' '}
            from <span className="font-medium">{pendingUndo.collectionName}</span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={undoLastRemoval}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={dismissUndo}
              aria-label="Dismiss undo notification"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      </SavedCollectionsProvider>
    </MotionConfig>
  );
}
