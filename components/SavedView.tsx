'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  FolderPlus,
  Info,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  MAX_COLLECTION_NAME_LENGTH,
  MIN_COLLECTION_NAME_LENGTH,
  READ_LATER_COLLECTION_ID,
  type SavedCollection,
} from '@/hooks/use-saved-items';
import {
  downloadTextFile,
  formatCollectionExport,
  getExportFileMeta,
  resolveExportItems,
  type ExportFormat,
} from '@/lib/collection-export';
import type { Discovery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DiscoveryCard } from './DiscoveryCard';
import { EmptyState } from './StateViews';

interface SavedViewProps {
  discoveries: Discovery[];
  collections: SavedCollection[];
  savedSlugs: string[];
  readLaterCollectionId?: string;
  activeCollectionId?: string;
  onSelectCollectionId?: (collectionId: string) => void;
  storageUnavailable: boolean;
  searchQuery: string;
  isSaved: (slug: string) => boolean;
  onToggleSave: (slug: string) => void;
  onRemoveFromCollection: (
    collectionId: string,
    slug: string,
    itemTitle?: string
  ) => void;
  onMoveInCollection?: (
    collectionId: string,
    slug: string,
    direction: 'up' | 'down'
  ) => void;
  onClearCollection?: (collectionId: string) => void;
  onCreateCollection: (rawName: string) => {
    ok: boolean;
    error?: string;
    collection?: SavedCollection;
  };
  onRenameCollection: (
    id: string,
    rawName: string
  ) => { ok: boolean; error?: string };
  onDeleteCollection: (id: string) => { ok: boolean; error?: string };
  onClearSearch: () => void;
}

const EXPORT_FORMATS: {
  id: ExportFormat;
  label: string;
  ext: string;
  description: string;
}[] = [
  {
    id: 'csv',
    label: 'CSV',
    ext: '.csv',
    description: 'Spreadsheet columns with RFC 4180 quoting',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    ext: '.md',
    description: 'Bulleted Markdown list with source links',
  },
  {
    id: 'text',
    label: 'Plain text',
    ext: '.txt',
    description: 'Readable text list of titles, dates, and URLs',
  },
];

export function SavedView({
  discoveries,
  collections,
  savedSlugs,
  readLaterCollectionId = READ_LATER_COLLECTION_ID,
  activeCollectionId,
  onSelectCollectionId,
  storageUnavailable,
  searchQuery,
  isSaved,
  onToggleSave,
  onRemoveFromCollection,
  onMoveInCollection,
  onClearCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onClearSearch,
}: SavedViewProps) {
  const [internalCollectionId, setInternalCollectionId] = useState<string>(
    () => activeCollectionId ?? collections[0]?.id ?? 'saved'
  );
  const selectedCollectionId = activeCollectionId ?? internalCollectionId;
  const setSelectedCollectionId = (id: string) => {
    setInternalCollectionId(id);
    onSelectCollectionId?.(id);
  };

  // Create collection state
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename collection state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete / clear confirmation state
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [confirmingClearQueue, setConfirmingClearQueue] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Consolidated export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] =
    useState<ExportFormat>('csv');
  const [copiedFormat, setCopiedFormat] = useState<ExportFormat | null>(null);
  const [copyFallbackContent, setCopyFallbackContent] = useState<{
    label: string;
    text: string;
  } | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const fallbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const exportCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (copyFallbackContent && fallbackTextareaRef.current) {
      fallbackTextareaRef.current.focus();
      fallbackTextareaRef.current.select();
    }
  }, [copyFallbackContent]);

  useEffect(() => {
    if (!exportModalOpen) return;

    window.requestAnimationFrame(() => {
      exportCloseRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExportModalOpen(false);
        setCopyFallbackContent(null);
        window.requestAnimationFrame(() => {
          exportTriggerRef.current?.focus();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exportModalOpen]);

  const activeCollection = useMemo(() => {
    return (
      collections.find((c) => c.id === selectedCollectionId) ?? collections[0]
    );
  }, [collections, selectedCollectionId]);

  const discoveryMap = useMemo(() => {
    const map = new Map<string, Discovery>();
    for (const d of discoveries) {
      map.set(d.slug, d);
    }
    return map;
  }, [discoveries]);

  const { availableItems, unavailableSlugs } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const available: Discovery[] = [];
    const unavailable: string[] = [];

    for (const slug of activeCollection?.slugs ?? []) {
      const found = discoveryMap.get(slug);
      if (found) {
        if (q) {
          const haystack = `${found.title} ${found.summary} ${found.source} ${found.domain} ${found.type}`.toLowerCase();
          if (!haystack.includes(q)) continue;
        }
        available.push(found);
      } else {
        if (q) {
          const haystack = `${slug} no longer available`.toLowerCase();
          if (!haystack.includes(q)) continue;
        }
        unavailable.push(slug);
      }
    }

    return { availableItems: available, unavailableSlugs: unavailable };
  }, [activeCollection, discoveryMap, searchQuery]);

  const exportItems = useMemo(
    () => resolveExportItems(activeCollection?.slugs ?? [], discoveryMap),
    [activeCollection, discoveryMap]
  );

  const handleSelectTab = (id: string) => {
    setSelectedCollectionId(id);
    setRenaming(false);
    setRenameError(null);
    setConfirmingDeleteId(null);
    setConfirmingClearQueue(false);
    setDeleteError(null);
    setExportModalOpen(false);
    setCopyFallbackContent(null);
  };

  const closeExportModal = () => {
    setExportModalOpen(false);
    setCopyFallbackContent(null);
    window.requestAnimationFrame(() => {
      exportTriggerRef.current?.focus();
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreateCollection(newCollectionName);
    if (!res.ok) {
      setCreateError(res.error ?? 'Unable to create collection.');
      return;
    }
    setNewCollectionName('');
    setCreateError(null);
    setCreating(false);
    if (res.collection) {
      setSelectedCollectionId(res.collection.id);
    }
  };

  const handleStartRename = () => {
    if (!activeCollection) return;
    setRenaming(true);
    setRenameValue(activeCollection.name);
    setRenameError(null);
    setConfirmingDeleteId(null);
    setDeleteError(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection) return;
    const res = onRenameCollection(activeCollection.id, renameValue);
    if (!res.ok) {
      setRenameError(res.error ?? 'Unable to rename collection.');
      return;
    }
    setRenaming(false);
    setRenameError(null);
  };

  const handleDeleteClick = () => {
    if (!activeCollection) return;
    setDeleteError(null);
    setRenaming(false);

    if (collections.length <= 1) {
      setDeleteError('At least one collection must remain.');
      return;
    }

    if (activeCollection.slugs.length > 0) {
      setConfirmingDeleteId(activeCollection.id);
      return;
    }

    const res = onDeleteCollection(activeCollection.id);
    if (!res.ok) {
      setDeleteError(res.error ?? 'Unable to delete collection.');
      return;
    }
    const nextCol = collections.find((c) => c.id !== activeCollection.id);
    if (nextCol) setSelectedCollectionId(nextCol.id);
  };

  const handleConfirmDelete = () => {
    if (!activeCollection) return;
    const res = onDeleteCollection(activeCollection.id);
    if (!res.ok) {
      setDeleteError(res.error ?? 'Unable to delete collection.');
      setConfirmingDeleteId(null);
      return;
    }
    setConfirmingDeleteId(null);
    const nextCol = collections.find((c) => c.id !== activeCollection.id);
    if (nextCol) setSelectedCollectionId(nextCol.id);
  };

  const handleDownloadExport = (format: ExportFormat) => {
    if (!activeCollection || activeCollection.slugs.length === 0) return;
    const content = formatCollectionExport(
      format,
      activeCollection.name,
      exportItems
    );
    const { filename, mimeType } = getExportFileMeta(
      format,
      activeCollection.name
    );
    downloadTextFile(content, filename, mimeType);
  };

  const handleCopyExport = async (format: ExportFormat, label: string) => {
    if (!activeCollection || activeCollection.slugs.length === 0) return;
    const content = formatCollectionExport(
      format,
      activeCollection.name,
      exportItems
    );

    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(content);
        setCopyFallbackContent(null);
        setCopiedFormat(format);
        copyTimerRef.current = window.setTimeout(() => {
          setCopiedFormat(null);
          copyTimerRef.current = null;
        }, 2000);
        return;
      } catch {
        // Fall back to selectable textarea
      }
    }

    setCopyFallbackContent({ label, text: content });
  };

  const activeSlugCount = activeCollection?.slugs.length ?? 0;
  const filteredTotalCount = availableItems.length + unavailableSlugs.length;
  const isReadLaterTab = activeCollection?.id === readLaterCollectionId;
  const isSearching = searchQuery.trim().length > 0;
  const selectedFormatMeta =
    EXPORT_FORMATS.find((f) => f.id === selectedExportFormat) ??
    EXPORT_FORMATS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            Saved Discoveries
          </h1>
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8] mt-1">
            Organize bookmarked items into named collections and export anytime.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8]">
            {savedSlugs.length} total saved · {collections.length}{' '}
            {collections.length === 1 ? 'collection' : 'collections'}
          </span>
        </div>
      </div>

      {storageUnavailable && (
        <div
          role="note"
          className="flex items-start sm:items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-800/70 dark:border-amber-400/60 bg-amber-500/12 text-xs text-amber-950 dark:text-amber-200"
        >
          <Info
            className="w-4 h-4 shrink-0 text-amber-800 dark:text-amber-300 mt-0.5 sm:mt-0"
            aria-hidden="true"
          />
          <span>
            Browser storage is unavailable. Your collections and saved items are kept for this session only and won&apos;t be saved.
          </span>
        </div>
      )}

      {/* Collections Tab Strip + New Collection */}
      <section aria-label="Saved collections" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Saved collections"
            className="flex flex-wrap items-center gap-2"
          >
            {collections.map((col) => {
              const isSelected = activeCollection?.id === col.id;
              const isQueue = col.id === readLaterCollectionId;
              return (
                <button
                  key={col.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectTab(col.id)}
                  className={cn(
                    'inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isSelected
                      ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                      : 'bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#e2e8f0] border-[#64748b] dark:border-[#64748b] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
                  )}
                >
                  {isQueue && (
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{col.name}</span>
                  <span
                    className={cn(
                      'font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded',
                      isSelected
                        ? 'bg-white/20 dark:bg-black/15'
                        : 'bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#475569] dark:text-[#94a3b8]'
                    )}
                  >
                    {col.slugs.length}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setCreating((prev) => !prev);
              setCreateError(null);
            }}
            aria-expanded={creating}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>New collection</span>
          </button>
        </div>

        {/* Create Collection Inline Form */}
        {creating && (
          <form
            onSubmit={handleCreateSubmit}
            className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-4 space-y-2.5"
            noValidate
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <label htmlFor="new-collection-name" className="sr-only">
                New collection name ({MIN_COLLECTION_NAME_LENGTH} to{' '}
                {MAX_COLLECTION_NAME_LENGTH} characters)
              </label>
              <input
                id="new-collection-name"
                type="text"
                value={newCollectionName}
                onChange={(e) => {
                  setNewCollectionName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                placeholder={`Collection name (${MIN_COLLECTION_NAME_LENGTH}–${MAX_COLLECTION_NAME_LENGTH} chars)`}
                aria-invalid={createError ? 'true' : undefined}
                aria-describedby={
                  createError ? 'create-collection-error' : undefined
                }
                autoFocus
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#475569] dark:placeholder:text-[#94a3b8] focus:border-[#1b4dff] dark:focus:border-[#7da1ff]"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewCollectionName('');
                    setCreateError(null);
                  }}
                  className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
            {createError && (
              <p
                id="create-collection-error"
                role="alert"
                className="text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {createError}
              </p>
            )}
          </form>
        )}
      </section>

      {/* Active Collection Panel (Rename, Delete, Export) */}
      {activeCollection && (
        <section
          role="tabpanel"
          aria-label={activeCollection.name}
          className="space-y-5"
        >
          <div className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {isReadLaterTab && (
                    <Clock
                      className="w-4 h-4 text-[#1b4dff] dark:text-[#7da1ff] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <h2 className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                    {activeCollection.name}
                  </h2>
                  {isReadLaterTab && (
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 text-[#1b4dff] dark:text-[#8eb0ff]">
                      Queue
                    </span>
                  )}
                </div>
                <p className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8] mt-0.5">
                  {activeSlugCount}{' '}
                  {isReadLaterTab
                    ? activeSlugCount === 1
                      ? 'queued item'
                      : 'queued items'
                    : activeSlugCount === 1
                      ? 'item'
                      : 'items'}
                  {isReadLaterTab && ' · synced with localStorage'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  ref={exportTriggerRef}
                  type="button"
                  onClick={() => {
                    setCopyFallbackContent(null);
                    setCopiedFormat(null);
                    setExportModalOpen(true);
                  }}
                  disabled={activeSlugCount === 0}
                  aria-haspopup="dialog"
                  aria-expanded={exportModalOpen}
                  title={
                    activeSlugCount === 0
                      ? 'Add items to enable export'
                      : `Export ${activeCollection.name}`
                  }
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Export</span>
                </button>

                {isReadLaterTab ? (
                  onClearCollection && (
                    <button
                      type="button"
                      onClick={() => setConfirmingClearQueue(true)}
                      disabled={activeSlugCount === 0}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#334155] dark:text-[#cbd5e1] hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-700 dark:hover:border-rose-400 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Clear queue</span>
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleStartRename}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Rename</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={collections.length <= 1}
                      title={
                        collections.length <= 1
                          ? 'At least one collection must remain'
                          : `Delete ${activeCollection.name}`
                      }
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#334155] dark:text-[#cbd5e1] hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-700 dark:hover:border-rose-400 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Rename Form */}
            {renaming && (
              <form
                onSubmit={handleRenameSubmit}
                className="pt-3 border-t border-[#7c8899]/50 dark:border-[#5a667a]/60 space-y-2"
                noValidate
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="rename-collection-input" className="sr-only">
                    Rename collection ({MIN_COLLECTION_NAME_LENGTH} to{' '}
                    {MAX_COLLECTION_NAME_LENGTH} characters)
                  </label>
                  <input
                    id="rename-collection-input"
                    type="text"
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      if (renameError) setRenameError(null);
                    }}
                    aria-invalid={renameError ? 'true' : undefined}
                    aria-describedby={
                      renameError ? 'rename-collection-error' : undefined
                    }
                    autoFocus
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] focus:border-[#1b4dff] dark:focus:border-[#7da1ff]"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer"
                    >
                      Save name
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(false);
                        setRenameError(null);
                      }}
                      className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                {renameError && (
                  <p
                    id="rename-collection-error"
                    role="alert"
                    className="text-xs font-medium text-rose-700 dark:text-rose-300"
                  >
                    {renameError}
                  </p>
                )}
              </form>
            )}

            {/* Clear Read Later Queue Confirmation */}
            {isReadLaterTab && confirmingClearQueue && onClearCollection && (
              <div
                role="alertdialog"
                aria-labelledby="clear-queue-confirm-title"
                className="pt-3 border-t border-rose-700/40 dark:border-rose-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p
                    id="clear-queue-confirm-title"
                    className="text-sm font-semibold text-rose-700 dark:text-rose-300"
                  >
                    Clear your Read Later queue?
                  </p>
                  <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
                    This removes all {activeSlugCount}{' '}
                    {activeSlugCount === 1 ? 'item' : 'items'} from Read Later.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmingClearQueue(false)}
                    className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearCollection(activeCollection.id);
                      setConfirmingClearQueue(false);
                    }}
                    className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-700 text-white dark:bg-rose-500 dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer"
                  >
                    Clear queue
                  </button>
                </div>
              </div>
            )}

            {/* Delete Non-Empty Collection Confirmation */}
            {confirmingDeleteId === activeCollection.id && (
              <div
                role="alertdialog"
                aria-labelledby="delete-collection-confirm-title"
                className="pt-3 border-t border-rose-700/40 dark:border-rose-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p
                    id="delete-collection-confirm-title"
                    className="text-sm font-semibold text-rose-700 dark:text-rose-300"
                  >
                    Delete &ldquo;{activeCollection.name}&rdquo;?
                  </p>
                  <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
                    This collection currently contains {activeSlugCount}{' '}
                    {activeSlugCount === 1 ? 'item' : 'items'}. Deleting it cannot be undone.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-700 text-white dark:bg-rose-500 dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer"
                  >
                    Delete collection
                  </button>
                </div>
              </div>
            )}

            {deleteError && (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {deleteError}
              </p>
            )}

          </div>

          {exportModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-modal-title"
              onClick={closeExportModal}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] shadow-xl p-5 sm:p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      id="export-modal-title"
                      className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9] break-words"
                    >
                      Export {activeCollection.name}
                    </h2>
                    <p className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8] mt-0.5">
                      {activeSlugCount}{' '}
                      {activeSlugCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <button
                    ref={exportCloseRef}
                    type="button"
                    onClick={closeExportModal}
                    aria-label="Close export modal"
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mt-1.5 -mr-1.5 rounded-lg text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Export format"
                  className="space-y-2"
                >
                  {EXPORT_FORMATS.map(({ id, label, ext, description }) => {
                    const isSelected = selectedExportFormat === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setSelectedExportFormat(id);
                          setCopyFallbackContent(null);
                        }}
                        className={cn(
                          'w-full min-h-[44px] flex items-start justify-between gap-3 px-3.5 py-3 rounded-lg border text-left transition-colors cursor-pointer',
                          isSelected
                            ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff]/8 dark:bg-[#4d7cff]/15'
                            : 'border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
                        )}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                              {label}
                            </span>
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-[#111827] border border-[#7c8899]/60 dark:border-[#5a667a]/60 text-[#475569] dark:text-[#94a3b8]">
                              {ext}
                            </span>
                          </div>
                          <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
                            {description}
                          </p>
                        </div>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                            isSelected
                              ? 'border-[#1b4dff] dark:border-[#7da1ff] bg-[#1b4dff] dark:bg-[#4d7cff] text-white dark:text-[#0b0f1a]'
                              : 'border-[#64748b] dark:border-[#64748b]'
                          )}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadExport(selectedFormatMeta.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Download {selectedFormatMeta.ext}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyExport(
                        selectedFormatMeta.id,
                        selectedFormatMeta.label
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] transition-colors cursor-pointer"
                  >
                    {copiedFormat === selectedFormatMeta.id ? (
                      <Check
                        className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {copiedFormat === selectedFormatMeta.id
                        ? 'Copied'
                        : 'Copy to clipboard'}
                    </span>
                  </button>
                </div>

                {copyFallbackContent && (
                  <div className="space-y-1.5 p-3 rounded-lg border border-[#64748b] dark:border-[#64748b] bg-[#f5f7fa] dark:bg-[#0b0f1a]">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="export-copy-fallback"
                        className="text-xs font-medium text-[#475569] dark:text-[#94a3b8]"
                      >
                        Copy {copyFallbackContent.label} export:
                      </label>
                      <button
                        type="button"
                        onClick={() => setCopyFallbackContent(null)}
                        aria-label="Close export copy box"
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    <textarea
                      ref={fallbackTextareaRef}
                      id="export-copy-fallback"
                      readOnly
                      rows={4}
                      value={copyFallbackContent.text}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full font-mono text-xs p-2.5 rounded border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {filteredTotalCount}{' '}
            {filteredTotalCount === 1 ? 'result' : 'results'}
          </div>

          {/* Collection Items / Empty States / Unavailable Items */}
          {activeSlugCount === 0 ? (
            <EmptyState
              title={
                isReadLaterTab
                  ? 'Your Read Later queue is empty'
                  : `"${activeCollection.name}" is empty`
              }
              description={
                isReadLaterTab
                  ? 'Click the Read Later clock button on any discovery card or article page to queue items to read later.'
                  : 'Use the bookmark button on any discovery card or item page to save entries into this collection.'
              }
              actionLabel="Explore Dashboard"
              actionHref="#/"
            />
          ) : filteredTotalCount === 0 ? (
            <EmptyState
              title="No items in this collection match your search"
              description="Clear the search query to see all entries saved in this collection."
              actionLabel="Clear search"
              onAction={onClearSearch}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableItems.map((item) => {
                const queueIdx = activeCollection.slugs.indexOf(item.slug);
                return (
                  <DiscoveryCard
                    key={item.slug}
                    item={item}
                    isSaved={isSaved(item.slug)}
                    onToggleSave={onToggleSave}
                    onRemoveAction={() =>
                      onRemoveFromCollection(
                        activeCollection.id,
                        item.slug,
                        item.title
                      )
                    }
                    removeActionLabel={isReadLaterTab ? 'Mark read' : 'Remove'}
                    queuePosition={
                      isReadLaterTab && queueIdx !== -1
                        ? queueIdx + 1
                        : undefined
                    }
                    onMoveUp={
                      isReadLaterTab &&
                      !isSearching &&
                      onMoveInCollection &&
                      queueIdx > 0
                        ? () =>
                            onMoveInCollection(
                              activeCollection.id,
                              item.slug,
                              'up'
                            )
                        : undefined
                    }
                    onMoveDown={
                      isReadLaterTab &&
                      !isSearching &&
                      onMoveInCollection &&
                      queueIdx !== -1 &&
                      queueIdx < activeCollection.slugs.length - 1
                        ? () =>
                            onMoveInCollection(
                              activeCollection.id,
                              item.slug,
                              'down'
                            )
                        : undefined
                    }
                  />
                );
              })}

              {unavailableSlugs.map((slug) => (
                <article
                  key={`unavailable-${slug}`}
                  className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-semibold">
                        No longer available
                      </h3>
                    </div>
                    <p className="text-sm text-[#475569] dark:text-[#94a3b8]">
                      This saved entry is no longer present in the discovery feed.
                    </p>
                    <p className="font-mono text-xs text-[#475569] dark:text-[#94a3b8] break-all">
                      {slug}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[#7c8899]/60 dark:border-[#5a667a]/70 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveFromCollection(activeCollection.id, slug)
                      }
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border border-[#64748b] dark:border-[#64748b] text-[#334155] dark:text-[#cbd5e1] hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-700 dark:hover:border-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
