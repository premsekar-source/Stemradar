'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bookmark, Check, Clock, FolderPlus, Plus, X } from 'lucide-react';
import {
  MAX_COLLECTION_NAME_LENGTH,
  READ_LATER_COLLECTION_ID,
  useSavedCollections,
} from '@/hooks/use-saved-items';
import { cn } from '@/lib/utils';

interface BookmarkCollectionButtonProps {
  slug: string;
  title: string;
  isSavedFallback?: boolean;
  onToggleSaveFallback?: (slug: string) => void;
  variant?: 'icon' | 'button';
}

export function BookmarkCollectionButton({
  slug,
  title,
  isSavedFallback = false,
  onToggleSaveFallback,
  variant = 'icon',
}: BookmarkCollectionButtonProps) {
  const ctx = useSavedCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();

  const saved = ctx ? ctx.isSaved(slug) : isSavedFallback;
  const collections = ctx?.collections ?? [];
  const memberIds = ctx ? ctx.getCollectionIdsForSlug(slug) : [];
  const hasMultipleCollections = collections.length > 1;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setShowCreateForm(false);
        setCreateError(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setShowCreateForm(false);
        setCreateError(null);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handlePrimaryClick = () => {
    if (!ctx) {
      onToggleSaveFallback?.(slug);
      return;
    }

    if (!hasMultipleCollections) {
      ctx.toggleSaved(slug, title);
      return;
    }

    setOpen((prev) => !prev);
    setCreateError(null);
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    const res = ctx.createCollection(newName);
    if (!res.ok) {
      setCreateError(res.error ?? 'Unable to create collection.');
      return;
    }
    if (res.collection) {
      ctx.addToCollection(res.collection.id, slug);
    }
    setNewName('');
    setCreateError(null);
    setShowCreateForm(false);
  };

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={handlePrimaryClick}
        aria-pressed={hasMultipleCollections ? undefined : saved}
        aria-expanded={hasMultipleCollections ? open : undefined}
        aria-controls={hasMultipleCollections && open ? popoverId : undefined}
        aria-haspopup={hasMultipleCollections ? 'dialog' : undefined}
        aria-label={
          hasMultipleCollections
            ? `Choose collections for ${title}`
            : saved
              ? `Remove ${title} from saved`
              : `Save ${title}`
        }
        className={
          variant === 'button'
            ? cn(
                'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                saved
                  ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]'
                  : 'border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            : cn(
                'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border transition-colors cursor-pointer',
                saved
                  ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]'
                  : 'border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
        }
      >
        <Bookmark
          className={cn('w-4 h-4 shrink-0', saved && 'fill-current')}
          aria-hidden="true"
        />
        {variant === 'button' && (
          <span>
            {saved
              ? memberIds.length > 1
                ? `Saved (${memberIds.length})`
                : 'Saved'
              : 'Save item'}
          </span>
        )}
      </button>

      {open && ctx && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`Save "${title}" to collections`}
          className={cn(
            'absolute top-full mt-1.5 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] shadow-lg p-3 space-y-2.5',
            variant === 'button' ? 'left-0 sm:right-0 sm:left-auto' : 'right-0'
          )}
        >
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#7c8899]/40 dark:border-[#5a667a]/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
              Collections
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close collections menu"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-1.5 rounded-md text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {collections.map((col) => {
              const checked = col.slugs.includes(slug);
              return (
                <button
                  key={col.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => ctx.toggleInCollection(col.id, slug, title)}
                  className={cn(
                    'w-full min-h-[44px] flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer',
                    checked
                      ? 'bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]'
                      : 'text-[#0f172a] dark:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        checked
                          ? 'bg-[#1b4dff] dark:bg-[#4d7cff] border-transparent text-white dark:text-[#0b0f1a]'
                          : 'border-[#64748b] dark:border-[#64748b]'
                      )}
                    >
                      {checked && (
                        <Check className="w-3 h-3" aria-hidden="true" />
                      )}
                    </span>
                    {col.id === READ_LATER_COLLECTION_ID && (
                      <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
                    )}
                    <span className="truncate">{col.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px] opacity-80 shrink-0">
                    {col.slugs.length}
                  </span>
                </button>
              );
            })}
          </div>

          {showCreateForm ? (
            <form
              onSubmit={handleCreateCollection}
              className="pt-1.5 border-t border-[#7c8899]/40 dark:border-[#5a667a]/50 space-y-1.5"
              noValidate
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  maxLength={MAX_COLLECTION_NAME_LENGTH + 5}
                  placeholder="Collection name"
                  aria-label="New collection name"
                  autoFocus
                  className="flex-1 min-w-0 min-h-[44px] px-2.5 py-1.5 rounded-md text-xs bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
              {createError && (
                <p
                  role="alert"
                  className="text-[11px] font-medium text-rose-700 dark:text-rose-300"
                >
                  {createError}
                </p>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1b4dff] dark:text-[#7da1ff] hover:bg-[#1b4dff]/5 dark:hover:bg-[#4d7cff]/10 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>New collection</span>
              <Plus className="w-3 h-3 ml-auto shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
