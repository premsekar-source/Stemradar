'use client';

import { memo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Trash2 } from 'lucide-react';
import type { Discovery } from '@/lib/types';
import {
  cn,
  formatDiscoveryDate,
  formatLinkCheckedTime,
  getDomainByName,
  isSafeHttpUrl,
} from '@/lib/utils';
import {
  DomainDot,
  NewBadge,
  SignificantBadge,
  SourceBadge,
  TypeChip,
} from './Badges';
import { BookmarkCollectionButton } from './BookmarkCollectionButton';
import { HighlightedText } from './HighlightedText';
import { ReadLaterButton } from './ReadLaterButton';

interface DiscoveryCardProps {
  item: Discovery;
  isSaved: boolean;
  isNew?: boolean;
  onToggleSave: (slug: string) => void;
  featured?: boolean;
  highlightKeywords?: readonly string[];
  onRemoveAction?: () => void;
  removeActionLabel?: string;
  queuePosition?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const DiscoveryCard = memo(function DiscoveryCard({
  item,
  isSaved,
  isNew = false,
  onToggleSave,
  featured = false,
  highlightKeywords,
  onRemoveAction,
  removeActionLabel = 'Remove',
  queuePosition,
  onMoveUp,
  onMoveDown,
}: DiscoveryCardProps) {
  const domainInfo = getDomainByName(item.domain);
  const dateInfo = formatDiscoveryDate(item.published_at, item.discovered_at);
  const linkCheckedLabel = formatLinkCheckedTime(item.last_verified_at);
  const hasSafeUrl = isSafeHttpUrl(item.url);

  return (
    <article
      className={cn(
        'rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] transition-colors flex flex-col justify-between',
        featured ? 'p-6 sm:p-7 min-h-[260px]' : 'p-5 min-h-[236px]',
        'hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
      )}
    >
      <div>
        {/* Top metadata row: Domain dot + name on left, New/type + quick actions on right */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {typeof queuePosition === 'number' && (
              <span className="font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff] shrink-0">
                #{queuePosition}
              </span>
            )}
            <DomainDot color={domainInfo?.color ?? '#4d7cff'} />
            {domainInfo ? (
              <a
                href={`#/domain/${encodeURIComponent(domainInfo.slug)}`}
                className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] truncate transition-colors"
              >
                {domainInfo.name}
              </a>
            ) : (
              <span className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] truncate">
                {item.domain}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isNew && <NewBadge />}
            <TypeChip type={item.type} />
            <ReadLaterButton slug={item.slug} title={item.title} variant="icon" />
            <BookmarkCollectionButton
              slug={item.slug}
              title={item.title}
              isSavedFallback={isSaved}
              onToggleSaveFallback={onToggleSave}
              variant="icon"
            />
          </div>
        </div>

        {/* Title */}
        <h3
          className={cn(
            'font-semibold text-[#0f172a] dark:text-[#f1f5f9] leading-snug mb-2 [text-wrap:balance] break-words',
            featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
          )}
        >
          <a
            href={`#/item/${encodeURIComponent(item.slug)}`}
            className="hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
          >
            <HighlightedText text={item.title} keywords={highlightKeywords} />
          </a>
        </h3>

        {/* Summary */}
        <p
          className={cn(
            'text-sm text-[#475569] dark:text-[#94a3b8] leading-relaxed mb-4 min-h-[4.25rem]',
            featured ? 'line-clamp-3 max-w-3xl' : 'line-clamp-3'
          )}
        >
          <HighlightedText text={item.summary} keywords={highlightKeywords} />
        </p>
      </div>

      {/* Footer metadata and actions */}
      <div className="pt-3 border-t border-[#7c8899]/60 dark:border-[#5a667a]/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#475569] dark:text-[#94a3b8]">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#0f172a] dark:text-[#e2e8f0]">
            <SourceBadge source={item.source} />
            <span>{item.source}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{dateInfo.label}</span>
          {linkCheckedLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{linkCheckedLabel}</span>
            </>
          )}
          {item.significant && (
            <>
              <span aria-hidden="true">·</span>
              <SignificantBadge />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              aria-label={`Move ${item.title} earlier in queue`}
              title="Move earlier in queue"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              aria-label={`Move ${item.title} later in queue`}
              title="Move later in queue"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {onRemoveAction && (
            <button
              type="button"
              onClick={onRemoveAction}
              aria-label={`${removeActionLabel} ${item.title}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#334155] dark:text-[#cbd5e1] hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-700 dark:hover:border-rose-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{removeActionLabel}</span>
            </button>
          )}
          <a
            href={`#/item/${encodeURIComponent(item.slug)}`}
            className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors whitespace-nowrap shrink-0"
          >
            Details
          </a>
          {featured && hasSafeUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <span>Open source</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
});
