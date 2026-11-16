'use client';

import { useMemo } from 'react';
import { Rss, X } from 'lucide-react';
import { DOMAINS } from '@/data/domains';
import type { Discovery } from '@/lib/types';
import { getDomainByName, sortDiscoveries } from '@/lib/utils';
import { DomainDot } from './Badges';
import { DiscoveryCard } from './DiscoveryCard';
import { KeywordsEditor } from './KeywordsEditor';
import { EmptyState } from './StateViews';

interface ForYouViewProps {
  discoveries: Discovery[];
  followedDomains: string[];
  followedKeywords: string[];
  storageUnavailable: boolean;
  onToggleFollowDomain: (domainSlug: string) => void;
  onAddKeyword: (raw: string) => { ok: boolean; error?: string };
  onRemoveKeyword: (keyword: string) => void;
  isSaved: (slug: string) => boolean;
  isNewItem: (discoveredAt: string | null | undefined) => boolean;
  onToggleSave: (slug: string) => void;
}

export function ForYouView({
  discoveries,
  followedDomains,
  followedKeywords,
  storageUnavailable,
  onToggleFollowDomain,
  onAddKeyword,
  onRemoveKeyword,
  isSaved,
  isNewItem,
  onToggleSave,
}: ForYouViewProps) {
  const followedDomainObjects = useMemo(() => {
    const slugSet = new Set(followedDomains);
    return DOMAINS.filter((d) => slugSet.has(d.slug));
  }, [followedDomains]);

  const matchedItems = useMemo(() => {
    if (followedDomains.length === 0 && followedKeywords.length === 0) {
      return [];
    }

    const domainSlugSet = new Set(followedDomains);
    const lowerKeywords = followedKeywords
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    const matching = discoveries.filter((item) => {
      const domainInfo = getDomainByName(item.domain);
      const itemDomainSlug = domainInfo?.slug ?? item.domain;
      if (domainSlugSet.has(itemDomainSlug)) {
        return true;
      }

      if (lowerKeywords.length > 0) {
        const titleLower = item.title.toLowerCase();
        const summaryLower = item.summary.toLowerCase();
        return lowerKeywords.some(
          (kw) => titleLower.includes(kw) || summaryLower.includes(kw)
        );
      }

      return false;
    });

    return sortDiscoveries(matching, 'newest');
  }, [discoveries, followedDomains, followedKeywords]);

  const nothingFollowed =
    followedDomains.length === 0 && followedKeywords.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Rss
              className="w-5 h-5 text-[#1b4dff] dark:text-[#7da1ff] shrink-0"
              aria-hidden="true"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
              For you
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8] mt-1 max-w-2xl">
            Personalized feed of discoveries in your followed domains or matching your followed keywords, sorted newest first.
          </p>
        </div>

        <div className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8] shrink-0">
          {matchedItems.length} {matchedItems.length === 1 ? 'match' : 'matches'}
        </div>
      </div>

      {/* Followed Domains Summary Bar (when any domain is followed) */}
      {followedDomainObjects.length > 0 && (
        <section
          aria-labelledby="followed-domains-heading"
          className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="followed-domains-heading"
              className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
            >
              Followed domains ({followedDomainObjects.length})
            </h2>
            <a
              href="#/"
              className="inline-flex items-center min-h-[44px] text-xs font-medium text-[#1b4dff] dark:text-[#7da1ff] hover:underline"
            >
              Browse all domains
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {followedDomainObjects.map((domain) => (
              <button
                key={domain.slug}
                type="button"
                onClick={() => onToggleFollowDomain(domain.slug)}
                aria-label={`Unfollow ${domain.name}`}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-rose-700 dark:hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
              >
                <DomainDot color={domain.color} size="sm" />
                <span>{domain.name}</span>
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Keywords I follow Editor */}
      <KeywordsEditor
        keywords={followedKeywords}
        onAddKeyword={onAddKeyword}
        onRemoveKeyword={onRemoveKeyword}
        storageUnavailable={storageUnavailable}
      />

      {/* Personalized Feed or Empty States */}
      {nothingFollowed ? (
        <EmptyState
          title="Nothing followed yet"
          description="To build your For you feed, click Follow on any domain tile on the Dashboard or on a domain page, or add keywords in the Keywords I follow editor above."
          actionLabel="Browse domains on Dashboard"
          actionHref="#/"
        />
      ) : matchedItems.length === 0 ? (
        <EmptyState
          title="No discoveries match your follows"
          description="No loaded discoveries currently match your followed domains or keywords. Try broadening your selection by following another domain or using broader keywords."
          actionLabel="Browse all domains"
          actionHref="#/"
        />
      ) : (
        <section aria-labelledby="for-you-feed-heading" className="space-y-3">
          <h2
            id="for-you-feed-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
          >
            Newest matches ({matchedItems.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchedItems.map((item) => (
              <DiscoveryCard
                key={item.slug}
                item={item}
                isSaved={isSaved(item.slug)}
                isNew={isNewItem(item.discovered_at)}
                onToggleSave={onToggleSave}
                highlightKeywords={followedKeywords}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
