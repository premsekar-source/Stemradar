'use client';

import { ArrowLeft, ArrowUpDown, Check, Loader2, Plus } from 'lucide-react';
import type { Discovery, SortOrder } from '@/lib/types';
import { cn, getDomainBySlug, sortDiscoveries } from '@/lib/utils';
import { DomainDot } from './Badges';
import { DiscoveryCard } from './DiscoveryCard';
import { StorageUnavailableNote } from './KeywordsEditor';
import { EmptyState } from './StateViews';

const TYPE_FILTER_ORDER = [
  'News',
  'Paper',
  'Video',
  'Mission',
  'Report',
  'Patent',
] as const;

interface DomainViewProps {
  domainSlug: string;
  discoveries: Discovery[];
  typeCounts: Map<string, number>;
  totalCount: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
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

export function DomainView({
  domainSlug,
  discoveries,
  typeCounts,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
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
}: DomainViewProps) {
  const domain = getDomainBySlug(domainSlug);

  if (!domain) {
    return (
      <EmptyState
        title="Domain not found"
        description="The requested STEM domain does not exist in the directory."
        actionLabel="Back to Dashboard"
        actionHref="#/"
        headingAs="h1"
      />
    );
  }

  const items = sortDiscoveries(discoveries, sortBy);
  const displayCount =
    selectedTypes.length === 0 && totalCount !== null
      ? totalCount
      : items.length;
  const selectedTypesLower = new Set(selectedTypes.map((t) => t.toLowerCase()));

  const following = isFollowingDomain(domain.slug);

  return (
    <div className="space-y-6">
      <div>
        <a
          href="#/"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </a>
      </div>

      {/* Domain Header */}
      <div className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <DomainDot color={domain.color} size="lg" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
                {domain.name}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8] max-w-2xl">
              {domain.description}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="font-mono tabular-nums text-sm font-medium px-3.5 py-2 rounded-lg bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#7c8899] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9]">
              {displayCount} {displayCount === 1 ? 'item' : 'items'}
            </div>
            <button
              type="button"
              onClick={() => onToggleFollowDomain(domain.slug)}
              aria-pressed={following}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                following
                  ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                  : 'bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] border-[#64748b] dark:border-[#64748b] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
              )}
            >
              {following ? (
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{following ? 'Following' : 'Follow'}</span>
            </button>
          </div>
        </div>
        {storageUnavailable && <StorageUnavailableNote />}
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {items.length} {items.length === 1 ? 'result' : 'results'}
      </div>

      {/* Multi-Select Type Chips next to Sort */}
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
          aria-label="Sort domain discoveries"
          className="inline-flex items-center self-start p-1 rounded-lg bg-[#eef2f7] dark:bg-[#161f33] border border-[#64748b] dark:border-[#64748b] shrink-0"
        >
          <ArrowUpDown
            className="w-3.5 h-3.5 text-[#475569] dark:text-[#94a3b8] mx-2 shrink-0"
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

      {/* Items */}
      {items.length === 0 ? (
        <EmptyState
          title={`No items in ${domain.name}`}
          description="Try clearing the type filter or search query to view available entries."
          actionLabel="Reset filters"
          onAction={onResetFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <DiscoveryCard
                key={item.slug}
                item={item}
                isSaved={isSaved(item.slug)}
                isNew={isNewItem(item.discovered_at)}
                onToggleSave={onToggleSave}
              />
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
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                <span>{loadingMore ? 'Loading more...' : 'Load more'}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
