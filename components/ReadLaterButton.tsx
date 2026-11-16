'use client';

import { Check, Clock } from 'lucide-react';
import { useSavedCollections } from '@/hooks/use-saved-items';
import { cn } from '@/lib/utils';

interface ReadLaterButtonProps {
  slug: string;
  title: string;
  variant?: 'icon' | 'button';
}

export function ReadLaterButton({
  slug,
  title,
  variant = 'icon',
}: ReadLaterButtonProps) {
  const ctx = useSavedCollections();
  if (!ctx) return null;

  const queued = ctx.isInReadLater(slug);

  const handleClick = () => {
    ctx.toggleReadLater(slug, title);
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={queued}
        aria-label={
          queued
            ? `Remove ${title} from Read Later`
            : `Add ${title} to Read Later`
        }
        className={cn(
          'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
          queued
            ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]'
            : 'border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] hover:bg-slate-100 dark:hover:bg-slate-800/60'
        )}
      >
        {queued ? (
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
        ) : (
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
        )}
        <span>{queued ? 'In Read Later' : 'Read Later'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={queued}
      aria-label={
        queued
          ? `Remove ${title} from Read Later`
          : `Add ${title} to Read Later`
      }
      title={
        queued ? 'In Read Later queue (click to remove)' : 'Add to Read Later'
      }
      className={cn(
        'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border transition-colors cursor-pointer',
        queued
          ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]'
          : 'border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/60'
      )}
    >
      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
    </button>
  );
}
