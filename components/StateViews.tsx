'use client';

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-700/70 dark:border-rose-400/60 bg-white dark:bg-[#111827] p-8 text-center max-w-xl mx-auto my-8"
    >
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-rose-500/12 text-rose-700 dark:text-rose-300 mb-4">
        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9] mb-2">
        Unable to load STEM Radar data
      </h1>
      <p className="text-sm text-[#475569] dark:text-[#94a3b8] mb-6">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        <span>Retry</span>
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  headingAs = 'h2',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  headingAs?: 'h1' | 'h2';
}) {
  const HeadingTag = headingAs;
  return (
    <div className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-8 text-center max-w-xl mx-auto">
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-slate-500/12 text-[#334155] dark:text-[#cbd5e1] mb-4">
        <Inbox className="w-5 h-5" aria-hidden="true" />
      </div>
      <HeadingTag className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9] mb-2">
        {title}
      </HeadingTag>
      <p className="text-sm text-[#475569] dark:text-[#94a3b8] mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
      {actionLabel && actionHref && !onAction && (
        <a
          href={actionHref}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
