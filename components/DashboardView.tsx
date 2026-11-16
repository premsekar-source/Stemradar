'use client';

import { memo, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  Filter,
  Globe,
  Info,
  Loader2,
  Plus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { DOMAINS } from '@/data/domains';
import type { Discovery, SortOrder } from '@/lib/types';
import { cn, groupDiscoveriesByDate } from '@/lib/utils';
import { DomainDot } from './Badges';
import { DiscoveryCard } from './DiscoveryCard';
import { StorageUnavailableNote } from './KeywordsEditor';
import { DashboardLiveGroundingPanel } from './LiveSearchGrounding';
import { EmptyState } from './StateViews';

const TYPE_FILTER_ORDER = [
  'News',
  'Paper',
  'Video',
  'Mission',
  'Report',
  'Patent',
] as const;

interface DashboardViewProps {
  discoveries: Discovery[];
  featuredItem: Discovery | null;
  domainCounts: Map<string, number>;
  domainNewThisWeekCounts: Map<string, number>;
  typeCounts: Map<string, number>;
  totalCount: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  showSampleBanner: boolean;
  searchQuery: string;
  selectedDomain: string;
  onSelectDomain: (domainSlug: string) => void;
  selectedTypes: string[];
  onToggleType: (type: string) => void;
  sortBy: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  isSaved: (slug: string) => boolean;
  isNewItem: (discoveredAt: string | null | undefined) => boolean;
  onToggleSave: (slug: string) => void;
  isFollowingDomain: (domainSlug: string) => boolean;
  onToggleFollowDomain: (domainSlug: string) => void;
  storageUnavailable: boolean;
  onResetFilters: () => void;
}

export const DashboardView = memo(function DashboardView({
  discoveries,
  featuredItem,
  domainCounts,
  domainNewThisWeekCounts,
  typeCounts,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
  showSampleBanner,
  searchQuery,
  selectedDomain,
  onSelectDomain,
  selectedTypes,
  onToggleType,
  sortBy,
  onSortChange,
  isSaved,
  isNewItem,
  onToggleSave,
  isFollowingDomain,
  onToggleFollowDomain,
  storageUnavailable,
  onResetFilters,
}: DashboardViewProps) {
  const [groundingOpen, setGroundingOpen] = useState(false);
  const [groundingTriggerKey, setGroundingTriggerKey] = useState(0);

  const groupedFeed = useMemo(
    () => groupDiscoveriesByDate(discoveries, sortBy),
    [discoveries, sortBy]
  );

  const totalIndexed = useMemo(
    () => Array.from(domainCounts.values()).reduce((sum, n) => sum + n, 0),
    [domainCounts]
  );

  const displayedResultCount =
    totalCount !== null && selectedTypes.length === 0
      ? totalCount
      : discoveries.length;

  const selectedTypesLower = new Set(selectedTypes.map((t) => t.toLowerCase()));
  const hasActiveFilters =
    selectedDomain !== 'all' ||
    selectedTypes.length > 0 ||
    searchQuery.trim().length > 0;
  const selectedDomainName =
    selectedDomain !== 'all'
      ? DOMAINS.find((d) => d.slug === selectedDomain)?.name
      : undefined;

  return (
    <div className="space-y-8">
      {/* Page Intro */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            Global STEM Discovery Hub
          </h1>
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8] mt-1 max-w-2xl">
            Curated discoveries across space science, aerospace, robotics, AI,
            electronics, scientific instruments, and peer-reviewed research.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#475569] dark:text-[#94a3b8] shrink-0">
          {totalIndexed > 0 ? totalIndexed : discoveries.length} indexed items · 9 domains
        </div>
      </div>

      {/* Sample Mode Banner (shown ONLY when Supabase env vars are missing) */}
      {showSampleBanner && (
        <div
          role="note"
          className="flex items-start sm:items-center gap-3 px-4 py-3 rounded-xl border border-[#1b4dff]/70 dark:border-[#7da1ff]/65 bg-[#1b4dff]/5 dark:bg-[#4d7cff]/10 text-sm text-[#0f172a] dark:text-[#e2e8f0]"
        >
          <Info
            className="w-4 h-4 text-[#1b4dff] dark:text-[#8eb0ff] shrink-0 mt-0.5 sm:mt-0"
            aria-hidden="true"
          />
          <p className="leading-snug">
            <strong className="font-semibold">Sample mode active:</strong>{' '}
            displaying labeled illustrative entries linked strictly to verified
            top-level institutional portals. Configure{' '}
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
              VITE_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
              VITE_SUPABASE_ANON_KEY
            </code>{' '}
            for live data.
          </p>
        </div>
      )}

      {/* Featured Discovery (hidden when user is actively searching) */}
      {featuredItem && !searchQuery.trim() && (
        <motion.section
          aria-labelledby="featured-heading"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              id="featured-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
            >
              Featured Discovery
            </h2>
          </div>
          <DiscoveryCard
            item={featuredItem}
            isSaved={isSaved(featuredItem.slug)}
            isNew={isNewItem(featuredItem.discovered_at)}
            onToggleSave={onToggleSave}
            featured
          />
        </motion.section>
      )}

      {/* 9 Domain Tiles */}
      {!searchQuery.trim() && (
        <section aria-labelledby="domains-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="domains-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
            >
              STEM Domains
            </h2>
          </div>
          {storageUnavailable && <StorageUnavailableNote />}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {DOMAINS.map((domain) => {
              const count = domainCounts.get(domain.slug) ?? 0;
              const newThisWeek = domainNewThisWeekCounts.get(domain.slug) ?? 0;
              const following = isFollowingDomain(domain.slug);
              return (
                <div
                  key={domain.slug}
                  className="group rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-4 min-h-[156px] flex flex-col justify-between gap-3 hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors"
                >
                  <a
                    href={`#/domain/${encodeURIComponent(domain.slug)}`}
                    className="flex items-start justify-between gap-3 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-2.5 mb-1">
                        <span className="mt-1.5 shrink-0">
                          <DomainDot color={domain.color} size="md" />
                        </span>
                        <span className="font-heading font-semibold text-sm text-[#0f172a] dark:text-[#f1f5f9] group-hover:text-[#1b4dff] dark:group-hover:text-[#7da1ff] transition-colors leading-snug">
                          {domain.name}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] dark:text-[#94a3b8] leading-relaxed pl-5">
                        {domain.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5 text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono tabular-nums text-xs font-medium text-[#0f172a] dark:text-[#e2e8f0] px-2 py-0.5 rounded bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#7c8899] dark:border-[#64748b]">
                          {count}
                        </span>
                        <ArrowRight
                          className="w-3.5 h-3.5 text-[#475569] dark:text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-hidden="true"
                        />
                      </div>
                      {newThisWeek > 0 && (
                        <span className="font-mono tabular-nums text-[11px] font-medium text-[#1b4dff] dark:text-[#8eb0ff] whitespace-nowrap">
                          {newThisWeek} new this week
                        </span>
                      )}
                    </div>
                  </a>

                  <div className="flex items-center justify-end pt-1 border-t border-[#7c8899]/40 dark:border-[#5a667a]/50">
                    <button
                      type="button"
                      onClick={() => onToggleFollowDomain(domain.slug)}
                      aria-pressed={following}
                      aria-label={
                        following
                          ? `Unfollow ${domain.name}`
                          : `Follow ${domain.name}`
                      }
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                        following
                          ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                          : 'bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] border-[#64748b] dark:border-[#64748b] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
                      )}
                    >
                      {following ? (
                        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{following ? 'Following' : 'Follow'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Discovery Feed with Filters, Multi-Select Type Chips & Sort */}
      <section aria-labelledby="feed-heading" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2
              id="feed-heading"
              className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9]"
            >
              {searchQuery.trim()
                ? `Search results for "${searchQuery.trim()}"`
                : 'Discovery Feed'}
            </h2>
            <span className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8]">
              (
              {totalCount !== null && selectedTypes.length === 0
                ? `${discoveries.length} of ${totalCount}`
                : discoveries.length}
              )
            </span>
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {displayedResultCount}{' '}
            {displayedResultCount === 1 ? 'result' : 'results'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter
              className="w-4 h-4 text-[#475569] dark:text-[#94a3b8] shrink-0"
              aria-hidden="true"
            />
            <label htmlFor="feed-domain-filter" className="sr-only">
              Filter by domain
            </label>
            <select
              id="feed-domain-filter"
              value={selectedDomain}
              onChange={(e) => onSelectDomain(e.target.value)}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white dark:bg-[#111827] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] cursor-pointer"
            >
              <option value="all">All domains</option>
              {DOMAINS.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim().length > 0) {
                  setGroundingOpen(true);
                  setGroundingTriggerKey((k) => k + 1);
                } else {
                  setGroundingOpen((prev) => !prev);
                }
              }}
              aria-expanded={groundingOpen}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                groundingOpen
                  ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                  : 'bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] border-[#64748b] dark:border-[#64748b] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
              )}
            >
              <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {searchQuery.trim().length > 0
                  ? 'Search Google for query'
                  : 'Live web search'}
              </span>
            </button>
          </div>
        </div>

        <DashboardLiveGroundingPanel
          initialQuery={searchQuery.trim()}
          selectedDomainName={selectedDomainName}
          isOpen={groundingOpen}
          onClose={() => setGroundingOpen(false)}
          autoTriggerKey={groundingTriggerKey}
        />

        {/* Multi-Select Type Filter Chips next to Sort Control */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter by discovery type (multi-select)"
            className="flex flex-wrap items-center gap-2"
          >
            {TYPE_FILTER_ORDER.map((type) => {
              const isSelected = selectedTypesLower.has(type.toLowerCase());
              const count = typeCounts.get(type.toLowerCase()) ?? 0;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  aria-pressed={isSelected}
                  className={cn(
                    'inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isSelected
                      ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                      : 'bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#e2e8f0] border-[#64748b] dark:border-[#64748b] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
                  )}
                >
                  <span>{type}</span>
                  <span
                    className={cn(
                      'font-mono tabular-nums text-[11px]',
                      isSelected
                        ? 'opacity-90'
                        : 'text-[#475569] dark:text-[#94a3b8]'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Sort discoveries"
            className="inline-flex items-center self-start p-1 rounded-lg bg-[#eef2f7] dark:bg-[#161f33] border border-[#64748b] dark:border-[#64748b] shrink-0"
          >
            <ArrowUpDown
              className="w-3.5 h-3.5 text-[#475569] dark:text-[#94a3b8] mx-2 shrink-0 hidden sm:block"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => onSortChange('newest')}
              aria-pressed={sortBy === 'newest'}
              className={cn(
                'min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                sortBy === 'newest'
                  ? 'bg-white dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] shadow-xs'
                  : 'text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
              )}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => onSortChange('significant')}
              aria-pressed={sortBy === 'significant'}
              className={cn(
                'min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                sortBy === 'significant'
                  ? 'bg-white dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] shadow-xs'
                  : 'text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
              )}
            >
              Significant
            </button>
          </div>
        </div>

        {/* Grouped Feed or Empty State */}
        {groupedFeed.length === 0 ? (
          <EmptyState
            title="No matching discoveries"
            description="No discoveries match your current domain, type, or search filters."
            actionLabel={hasActiveFilters ? 'Reset filters' : undefined}
            onAction={hasActiveFilters ? onResetFilters : undefined}
          />
        ) : (
          <>
            <div className="space-y-8">
              {groupedFeed.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#7c8899]/60 dark:border-[#5a667a]/70 pb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
                      {group.label}
                    </h3>
                    <span className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8]">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.items.map((item) => (
                      <DiscoveryCard
                        key={item.slug}
                        item={item}
                        isSaved={isSaved(item.slug)}
                        isNew={isNewItem(item.discovered_at)}
                        onToggleSave={onToggleSave}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-semibold border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loadingMore && (
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  <span>{loadingMore ? 'Loading more...' : 'Load more'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
});
