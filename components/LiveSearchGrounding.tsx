'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { Discovery } from '@/lib/types';
import { formatRelativeSavedTime, isSafeHttpUrl } from '@/lib/utils';

interface GroundedSourceLink {
  title: string;
  uri: string;
}

interface GroundingResponseData {
  text: string;
  sources: GroundedSourceLink[];
  queries: string[];
  verifiedAt: string;
}

function splitCleanParagraphs(raw: string): string[] {
  return raw
    .split(/\n{2,}/)
    .map((block) => block.replace(/\*\*/g, '').trim())
    .filter((block) => block.length > 0);
}

function GroundingResultsBody({ data }: { data: GroundingResponseData }) {
  const paragraphs = splitCleanParagraphs(data.text);
  const safeSources = data.sources.filter((s) => isSafeHttpUrl(s.uri));

  return (
    <div className="space-y-4">
      {paragraphs.length > 0 && (
        <div className="space-y-2.5 text-sm sm:text-[15px] text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed">
          {paragraphs.map((para, idx) => (
            <p key={idx} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
      )}

      {safeSources.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#7c8899]/60 dark:border-[#5a667a]/70">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
            Grounded Web Sources ({safeSources.length})
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {safeSources.map((src) => (
              <li key={src.uri}>
                <a
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 rounded-lg border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a] text-xs font-medium text-[#1b4dff] dark:text-[#7da1ff] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors"
                >
                  <span className="truncate">{src.title}</span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-[#475569] dark:text-[#94a3b8]">
        {data.queries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Queries:</span>
            {data.queries.slice(0, 3).map((q) => (
              <span
                key={q}
                className="px-2 py-0.5 rounded bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#7c8899] dark:border-[#64748b] text-[#0f172a] dark:text-[#e2e8f0]"
              >
                {q}
              </span>
            ))}
          </div>
        )}
        <span className="tabular-nums">
          Grounded · {formatRelativeSavedTime(data.verifiedAt).replace(/^Saved\s+/, '')}
        </span>
      </div>
    </div>
  );
}

export function ItemLiveGroundingCard({ item }: { item: Discovery }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GroundingResponseData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [item.slug]);

  const runItemGrounding = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('./api/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'item',
          title: item.title,
          domain: item.domain,
          source: item.source,
          summary: item.summary,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json()) as Partial<GroundingResponseData> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          payload.error || 'Unable to load Google Search context.'
        );
      }

      setData({
        text: payload.text ?? '',
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        queries: Array.isArray(payload.queries) ? payload.queries : [],
        verifiedAt: payload.verifiedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch Google Search grounding updates.'
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <section
      aria-labelledby="live-context-heading"
      className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe
              className="w-4 h-4 text-[#1b4dff] dark:text-[#7da1ff] shrink-0"
              aria-hidden="true"
            />
            <h2
              id="live-context-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9]"
            >
              Live Web Context
            </h2>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
            Retrieve recent Google Search updates and primary citations for this discovery.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void runItemGrounding();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loading ? (
            <Loader2
              className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : data ? (
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>
            {loading
              ? 'Searching web...'
              : data
                ? 'Refresh web context'
                : 'Search Google updates'}
          </span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-lg border border-rose-700/70 dark:border-rose-400/60 bg-rose-500/10 text-xs sm:text-sm text-rose-800 dark:text-rose-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {data && <GroundingResultsBody data={data} />}
    </section>
  );
}

interface DashboardLiveGroundingPanelProps {
  initialQuery: string;
  selectedDomainName?: string;
  isOpen: boolean;
  onClose: () => void;
  autoTriggerKey?: number;
}

export function DashboardLiveGroundingPanel({
  initialQuery,
  selectedDomainName,
  isOpen,
  onClose,
  autoTriggerKey = 0,
}: DashboardLiveGroundingPanelProps) {
  const [topic, setTopic] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GroundingResponseData | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastTriggerKeyRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const executeSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setError('Enter a STEM topic or keyword to search.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('./api/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'topic',
          query: trimmed,
          domain: selectedDomainName,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json()) as Partial<GroundingResponseData> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          payload.error || 'Unable to load Google Search grounding results.'
        );
      }

      setData({
        text: payload.text ?? '',
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        queries: Array.isArray(payload.queries) ? payload.queries : [],
        verifiedAt: payload.verifiedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch Google Search grounding results.'
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen || autoTriggerKey === 0) return;
    if (lastTriggerKeyRef.current === autoTriggerKey) return;
    lastTriggerKeyRef.current = autoTriggerKey;

    const trimmed = initialQuery.trim();
    if (!trimmed) return;
    Promise.resolve().then(() => {
      setTopic(trimmed);
      void executeSearch(trimmed);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoTriggerKey, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <section
      aria-labelledby="live-grounding-panel-heading"
      className="rounded-xl border border-[#1b4dff]/70 dark:border-[#7da1ff]/65 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe
              className="w-4 h-4 text-[#1b4dff] dark:text-[#7da1ff] shrink-0"
              aria-hidden="true"
            />
            <h3
              id="live-grounding-panel-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9]"
            >
              Google Search Grounding
            </h3>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
            Query up-to-date STEM developments and verified source links from Google Search.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Google Search Grounding panel"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void executeSearch(topic);
        }}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        <label htmlFor="live-grounding-input" className="sr-only">
          Search Google for STEM topics
        </label>
        <input
          id="live-grounding-input"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Starship Flight 6 telemetry, NIST post-quantum standards..."
          className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#475569] dark:placeholder:text-[#94a3b8] focus:border-[#1b4dff] dark:focus:border-[#7da1ff]"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loading ? (
            <Loader2
              className="w-4 h-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Search className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{loading ? 'Searching...' : 'Search Google'}</span>
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-lg border border-rose-700/70 dark:border-rose-400/60 bg-rose-500/10 text-xs sm:text-sm text-rose-800 dark:text-rose-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {data && <GroundingResultsBody data={data} />}
    </section>
  );
}
