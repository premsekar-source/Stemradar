'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Calendar,
  Check,
  Clock,
  Copy,
  Flag,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Discovery } from '@/lib/types';
import {
  estimateReadingTime,
  formatDate,
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
import { DiscoveryCard } from './DiscoveryCard';
import { ItemLiveGroundingCard } from './LiveSearchGrounding';
import type { VoiceTopicContext } from './LiveVoiceModal';
import { ReadLaterButton } from './ReadLaterButton';
import { EmptyState } from './StateViews';

interface ItemViewProps {
  itemSlug: string;
  discoveries: Discovery[];
  mode: 'live' | 'sample';
  isSaved: (slug: string) => boolean;
  isNewItem?: (discoveredAt: string | null | undefined) => boolean;
  onToggleSave: (slug: string) => void;
  onDiscussByVoice?: (context: VoiceTopicContext) => void;
}

export function ItemView({
  itemSlug,
  discoveries,
  mode,
  isSaved,
  isNewItem,
  onToggleSave,
  onDiscussByVoice,
}: ItemViewProps) {
  const item = discoveries.find((d) => d.slug === itemSlug);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const shareResetRef = useRef<number | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const [readProgress, setReadProgress] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<
    'idle' | 'shared' | 'copied' | 'unavailable'
  >('idle');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'fallback'>(
    'idle'
  );
  const [fallbackText, setFallbackText] = useState<string>('');
  const [fallbackLabel, setFallbackLabel] = useState<string>('Copy page address:');

  const hasItem = Boolean(item);

  useEffect(() => {
    let rafId = 0;

    const updateProgress = () => {
      rafId = 0;
      const summaryEl = summaryRef.current;
      const docScrollable =
        document.documentElement.scrollHeight - window.innerHeight;

      if (!summaryEl) {
        const fallback =
          docScrollable > 0
            ? Math.min(1, Math.max(0, window.scrollY / docScrollable))
            : 0;
        setReadProgress(Math.round(fallback * 100));
        return;
      }

      const rect = summaryEl.getBoundingClientRect();
      const summaryBottomDocY = rect.bottom + window.scrollY;
      const summaryScrollable = summaryBottomDocY - window.innerHeight;

      const targetMax =
        summaryScrollable > 0 ? summaryScrollable : docScrollable;

      if (targetMax <= 0) {
        setReadProgress(0);
        return;
      }

      const ratio = Math.min(1, Math.max(0, window.scrollY / targetMax));
      setReadProgress(Math.round(ratio * 100));
    };

    const scheduleUpdate = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(updateProgress);
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [itemSlug, hasItem]);

  useEffect(() => {
    return () => {
      if (shareResetRef.current !== null) {
        window.clearTimeout(shareResetRef.current);
      }
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (copyStatus === 'fallback' && fallbackInputRef.current) {
      fallbackInputRef.current.focus();
      fallbackInputRef.current.select();
    }
  }, [copyStatus]);

  if (!item) {
    return (
      <EmptyState
        title="Discovery not found"
        description="The requested STEM Radar item could not be found in the current dataset."
        actionLabel="Return to Dashboard"
        actionHref="#/"
        headingAs="h1"
      />
    );
  }

  const domainInfo = getDomainByName(item.domain);
  const dateInfo = formatDiscoveryDate(item.published_at, item.discovered_at);
  const linkCheckedLabel = formatLinkCheckedTime(item.last_verified_at);
  const readingTimeLabel = estimateReadingTime(item.summary);
  const safeExternalUrl = isSafeHttpUrl(item.url);
  const saved = isSaved(item.slug);
  const isNew = isNewItem ? isNewItem(item.discovered_at) : false;

  const scheduleShareReset = () => {
    if (shareResetRef.current !== null) {
      window.clearTimeout(shareResetRef.current);
    }
    shareResetRef.current = window.setTimeout(() => {
      setShareFeedback('idle');
      shareResetRef.current = null;
    }, 2500);
  };

  const handleShare = async () => {
    const shareUrl = safeExternalUrl ? item.url : window.location.href;
    const shareText = `${item.title}\n${shareUrl}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: item.title,
          url: shareUrl,
        });
        setShareFeedback('shared');
        scheduleShareReset();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('copied');
        scheduleShareReset();
        return;
      } catch {
        // Clipboard permission denied — fall back to selectable input
      }
    }

    setFallbackLabel('Copy share text:');
    setFallbackText(shareText);
    setCopyStatus('fallback');
    setShareFeedback('unavailable');
    scheduleShareReset();
  };

  const handleCopyLink = async () => {
    const pageUrl = window.location.href;

    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(pageUrl);
        setCopyStatus('copied');
        copyResetRef.current = window.setTimeout(() => {
          setCopyStatus('idle');
          copyResetRef.current = null;
        }, 2000);
        return;
      } catch {
        // Fall back to selecting the address text
      }
    }

    setFallbackLabel('Copy page address:');
    setFallbackText(pageUrl);
    setCopyStatus('fallback');
    if (fallbackInputRef.current) {
      fallbackInputRef.current.focus();
      fallbackInputRef.current.select();
    }
  };

  const relatedItems = discoveries
    .filter((d) => d.slug !== item.slug && d.domain === item.domain)
    .slice(0, 2);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Fixed Reading Progress Indicator Bar at very top of screen */}
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={readProgress}
        className="fixed top-0 inset-x-0 z-50 h-1.5 w-full bg-[#eef2f7] dark:bg-[#1f293d] border-b border-[#7c8899] dark:border-[#64748b] pointer-events-none"
      >
        <div
          className="h-full w-full origin-left bg-[#1b4dff] dark:bg-[#4d7cff] transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${readProgress / 100})` }}
        />
      </div>

      {/* Navigation Back */}
      <div className="flex flex-wrap items-center gap-4">
        <a
          href="#/"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Dashboard</span>
        </a>
        {domainInfo && (
          <>
            <span className="text-[#475569] dark:text-[#94a3b8]" aria-hidden="true">
              /
            </span>
            <a
              href={`#/domain/${encodeURIComponent(domainInfo.slug)}`}
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
            >
              <DomainDot color={domainInfo.color} />
              <span>{domainInfo.name}</span>
            </a>
          </>
        )}
      </div>

      {/* Main Article Detail */}
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <DomainDot color={domainInfo?.color ?? '#4d7cff'} size="md" />
              <span className="text-sm font-medium text-[#475569] dark:text-[#94a3b8]">
                {domainInfo?.name ?? item.domain}
              </span>
            </div>
            <TypeChip type={item.type} />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#cbd5e1] whitespace-nowrap shrink-0">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{readingTimeLabel}</span>
            </span>
            {item.significant && <SignificantBadge />}
            {isNew && <NewBadge />}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {mode === 'sample' && (
              <span className="text-xs font-mono text-[#1b4dff] dark:text-[#8eb0ff]">
                Sample record
              </span>
            )}
            <button
              type="button"
              onClick={handleShare}
              aria-label={`Share ${item.title}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {shareFeedback === 'shared' || shareFeedback === 'copied' ? (
                <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>
                {shareFeedback === 'shared'
                  ? 'Shared'
                  : shareFeedback === 'copied'
                    ? 'Copied text'
                    : shareFeedback === 'unavailable'
                      ? 'Copy below'
                      : 'Share'}
              </span>
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] leading-tight [text-wrap:balance] break-words">
          {item.title}
        </h1>

        {/* Structured Metadata Strip */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-[#7c8899]/60 dark:border-[#5a667a]/70">
          <div>
            <dt className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1">
              Source
            </dt>
            <dd className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-2">
              <SourceBadge source={item.source} />
              <span>{item.source}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1">
              {dateInfo.isFoundFallback ? 'Discovery date' : 'Publication date'}
            </dt>
            <dd className="text-sm font-mono tabular-nums font-medium text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#475569] dark:text-[#94a3b8] shrink-0" aria-hidden="true" />
              <span>{dateInfo.label}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1">
              Indexed
            </dt>
            <dd className="text-sm font-mono tabular-nums text-[#0f172a] dark:text-[#f1f5f9]">
              {formatDate(item.discovered_at)}
            </dd>
            {linkCheckedLabel && (
              <dd className="text-xs font-mono tabular-nums text-[#475569] dark:text-[#94a3b8] mt-1">
                {linkCheckedLabel}
              </dd>
            )}
          </div>
        </dl>

        {/* Summary */}
        <div ref={summaryRef} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
            Summary
          </h2>
          <p className="text-base text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed">
            {item.summary}
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {safeExternalUrl ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <span>Open original source</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm border border-amber-800/70 dark:border-amber-400/60 bg-amber-500/12 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>External link unavailable (unsupported protocol)</span>
              </div>
            )}

            <ReadLaterButton slug={item.slug} title={item.title} variant="button" />

            <BookmarkCollectionButton
              slug={item.slug}
              title={item.title}
              isSavedFallback={saved}
              onToggleSaveFallback={onToggleSave}
              variant="button"
            />

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copyStatus === 'copied' ? (
                <Check
                  className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{copyStatus === 'copied' ? 'Copied' : 'Copy link'}</span>
            </button>

            {onDiscussByVoice && (
              <button
                type="button"
                onClick={() =>
                  onDiscussByVoice({
                    title: item.title,
                    domain: item.domain,
                    source: item.source,
                    summary: item.summary,
                  })
                }
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border border-[#1b4dff]/60 dark:border-[#7da1ff]/60 bg-[#1b4dff]/8 dark:bg-[#4d7cff]/12 text-[#1b4dff] dark:text-[#7da1ff] hover:bg-[#1b4dff]/15 dark:hover:bg-[#4d7cff]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AudioLines className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Discuss by voice</span>
              </button>
            )}
          </div>

          {copyStatus === 'fallback' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a]">
              <label
                htmlFor="copy-link-fallback"
                className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] shrink-0"
              >
                {fallbackLabel}
              </label>
              <input
                ref={fallbackInputRef}
                id="copy-link-fallback"
                type="text"
                readOnly
                value={fallbackText}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9]"
              />
            </div>
          )}

          <div className="pt-2 border-t border-[#7c8899]/40 dark:border-[#5a667a]/50 flex justify-end">
            <a
              href={`#/contact?title=${encodeURIComponent(
                item.title
              )}&url=${encodeURIComponent(
                safeExternalUrl ? item.url : `#/item/${item.slug}`
              )}`}
              className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Report a problem</span>
            </a>
          </div>
        </div>
      </motion.article>

      {/* Live Web Context via Google Search Grounding */}
      <ItemLiveGroundingCard item={item} />

      {/* Related Discoveries */}
      {relatedItems.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-3">
          <h2
            id="related-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
          >
            More in {domainInfo?.name ?? item.domain}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedItems.map((rel) => (
              <DiscoveryCard
                key={rel.slug}
                item={rel}
                isSaved={isSaved(rel.slug)}
                isNew={isNewItem ? isNewItem(rel.discovered_at) : false}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
