'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export interface SavedCollection {
  id: string;
  name: string;
  slugs: string[];
}

export interface PendingUndoRemoval {
  slug: string;
  collectionId: string;
  collectionName: string;
  index: number;
  label: string;
}

const LEGACY_STORAGE_KEY = 'stem-radar-saved-slugs';
const COLLECTIONS_STORAGE_KEY = 'stem-radar-saved-collections';
const CHANGE_EVENT = 'stem-radar-saved-change';

export const DEFAULT_COLLECTION_ID = 'saved';
export const DEFAULT_COLLECTION_NAME = 'Saved';
export const READ_LATER_COLLECTION_ID = 'read-later';
export const READ_LATER_COLLECTION_NAME = 'Read Later';
export const MIN_COLLECTION_NAME_LENGTH = 1;
export const MAX_COLLECTION_NAME_LENGTH = 40;
export const UNDO_DURATION_MS = 5000;

interface CollectionsSnapshot {
  collections: SavedCollection[];
  storageUnavailable: boolean;
}

function createDefaultCollections(slugs: string[] = []): SavedCollection[] {
  return [
    {
      id: DEFAULT_COLLECTION_ID,
      name: DEFAULT_COLLECTION_NAME,
      slugs: deduplicateStrings(slugs),
    },
    {
      id: READ_LATER_COLLECTION_ID,
      name: READ_LATER_COLLECTION_NAME,
      slugs: [],
    },
  ];
}

function ensureBuiltInCollections(
  collections: SavedCollection[]
): { collections: SavedCollection[]; changed: boolean } {
  let changed = false;
  const list = [...collections];

  const hasReadLater = list.some(
    (c) =>
      c.id === READ_LATER_COLLECTION_ID ||
      c.name.trim().toLowerCase() === READ_LATER_COLLECTION_NAME.toLowerCase()
  );

  if (!hasReadLater) {
    const readLaterCollection: SavedCollection = {
      id: READ_LATER_COLLECTION_ID,
      name: READ_LATER_COLLECTION_NAME,
      slugs: [],
    };
    const savedIndex = list.findIndex((c) => c.id === DEFAULT_COLLECTION_ID);
    if (savedIndex !== -1) {
      list.splice(savedIndex + 1, 0, readLaterCollection);
    } else {
      list.unshift(readLaterCollection);
    }
    changed = true;
  }

  return { collections: list, changed };
}

// Session-only in-memory fallback when localStorage is unavailable.
let memoryCollections: SavedCollection[] = createDefaultCollections();
let memoryStorageUnavailable: boolean | null = null;
let migrationAttempted = false;

const SERVER_SNAPSHOT_RAW = JSON.stringify({
  collections: createDefaultCollections(),
  storageUnavailable: false,
} satisfies CollectionsSnapshot);

function deduplicateStrings(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const val of values) {
    if (typeof val !== 'string') continue;
    if (!seen.has(val)) {
      seen.add(val);
      out.push(val);
    }
  }
  return out;
}

function parseLegacySlugs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? deduplicateStrings(parsed) : [];
  } catch {
    return [];
  }
}

function parseCollectionsArray(raw: string | null): SavedCollection[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const valid: SavedCollection[] = [];
    const seenIds = new Set<string>();

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      const name = typeof obj.name === 'string' ? obj.name.trim() : '';
      if (!id || !name || seenIds.has(id)) continue;
      seenIds.add(id);
      const slugs = Array.isArray(obj.slugs) ? deduplicateStrings(obj.slugs) : [];
      valid.push({ id, name, slugs });
    }

    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function detectStorageAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  if (memoryStorageUnavailable !== null) {
    return !memoryStorageUnavailable;
  }
  try {
    const testKey = '__stem_radar_saved_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    memoryStorageUnavailable = false;
    return true;
  } catch {
    memoryStorageUnavailable = true;
    return false;
  }
}

function ensureMigratedIfNeeded(): SavedCollection[] | null {
  if (typeof window === 'undefined' || !detectStorageAvailable()) {
    return null;
  }

  try {
    const existingRaw = window.localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    const existing = parseCollectionsArray(existingRaw);
    if (existing) {
      migrationAttempted = true;
      const ensured = ensureBuiltInCollections(existing);
      if (ensured.changed) {
        window.localStorage.setItem(
          COLLECTIONS_STORAGE_KEY,
          JSON.stringify(ensured.collections)
        );
      }
      return ensured.collections;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const legacySlugs = parseLegacySlugs(legacyRaw);
    const initial = createDefaultCollections(legacySlugs);

    if (!migrationAttempted) {
      migrationAttempted = true;
      window.localStorage.setItem(
        COLLECTIONS_STORAGE_KEY,
        JSON.stringify(initial)
      );
      if (legacyRaw !== null) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }

    return initial;
  } catch {
    memoryStorageUnavailable = true;
    return null;
  }
}

function subscribeSaved(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === COLLECTIONS_STORAGE_KEY ||
      e.key === LEGACY_STORAGE_KEY ||
      e.key === null
    ) {
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSavedSnapshot(): string {
  if (!detectStorageAvailable()) {
    return JSON.stringify({
      collections: memoryCollections,
      storageUnavailable: true,
    } satisfies CollectionsSnapshot);
  }

  const migratedOrLoaded = ensureMigratedIfNeeded();
  if (!migratedOrLoaded) {
    return JSON.stringify({
      collections: memoryCollections,
      storageUnavailable: Boolean(memoryStorageUnavailable),
    } satisfies CollectionsSnapshot);
  }

  memoryCollections = migratedOrLoaded;
  return JSON.stringify({
    collections: migratedOrLoaded,
    storageUnavailable: false,
  } satisfies CollectionsSnapshot);
}

function getSavedServerSnapshot(): string {
  return SERVER_SNAPSHOT_RAW;
}

function writeCollections(collections: SavedCollection[]) {
  const baseCollections =
    collections.length > 0 ? collections : createDefaultCollections();
  const { collections: safeCollections } =
    ensureBuiltInCollections(baseCollections);
  memoryCollections = safeCollections;

  if (detectStorageAvailable()) {
    try {
      window.localStorage.setItem(
        COLLECTIONS_STORAGE_KEY,
        JSON.stringify(safeCollections)
      );
    } catch {
      memoryStorageUnavailable = true;
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function generateCollectionId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'collection';

  if (!existingIds.has(base)) return base;

  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export interface SavedCollectionsContextValue {
  collections: SavedCollection[];
  savedSlugs: string[];
  readLaterCollectionId: string;
  readLaterSlugs: string[];
  storageUnavailable: boolean;
  isSaved: (slug: string) => boolean;
  isInReadLater: (slug: string) => boolean;
  isSavedInCollection: (collectionId: string, slug: string) => boolean;
  getCollectionIdsForSlug: (slug: string) => string[];
  toggleSaved: (slug: string, itemTitle?: string) => void;
  toggleReadLater: (slug: string, itemTitle?: string) => void;
  addToCollection: (collectionId: string, slug: string) => void;
  removeFromCollection: (
    collectionId: string,
    slug: string,
    itemTitle?: string
  ) => void;
  toggleInCollection: (
    collectionId: string,
    slug: string,
    itemTitle?: string
  ) => void;
  moveInCollection: (
    collectionId: string,
    slug: string,
    direction: 'up' | 'down'
  ) => void;
  clearCollection: (collectionId: string) => void;
  createCollection: (rawName: string) => {
    ok: boolean;
    error?: string;
    collection?: SavedCollection;
  };
  renameCollection: (
    id: string,
    rawName: string
  ) => { ok: boolean; error?: string };
  deleteCollection: (id: string) => { ok: boolean; error?: string };
  clearSaved: () => void;
  pendingUndo: PendingUndoRemoval | null;
  undoLastRemoval: () => void;
  dismissUndo: () => void;
}

export function useSavedItems(): SavedCollectionsContextValue {
  const raw = useSyncExternalStore(
    subscribeSaved,
    getSavedSnapshot,
    getSavedServerSnapshot
  );

  const [pendingUndo, setPendingUndo] = useState<PendingUndoRemoval | null>(
    null
  );
  const undoTimerRef = useRef<number | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, [clearUndoTimer]);

  const snapshot = useMemo<CollectionsSnapshot>(() => {
    try {
      const parsed = JSON.parse(raw) as Partial<CollectionsSnapshot>;
      const cols =
        Array.isArray(parsed.collections) && parsed.collections.length > 0
          ? parsed.collections
          : createDefaultCollections();
      return {
        collections: cols,
        storageUnavailable: Boolean(parsed.storageUnavailable),
      };
    } catch {
      return {
        collections: createDefaultCollections(),
        storageUnavailable: false,
      };
    }
  }, [raw]);

  const collections = snapshot.collections;

  const readLaterCollection = useMemo(
    () =>
      collections.find((c) => c.id === READ_LATER_COLLECTION_ID) ??
      collections.find(
        (c) =>
          c.name.trim().toLowerCase() ===
          READ_LATER_COLLECTION_NAME.toLowerCase()
      ),
    [collections]
  );

  const readLaterCollectionId =
    readLaterCollection?.id ?? READ_LATER_COLLECTION_ID;
  const readLaterSlugs = useMemo(
    () => readLaterCollection?.slugs ?? [],
    [readLaterCollection]
  );
  const readLaterSet = useMemo(() => new Set(readLaterSlugs), [readLaterSlugs]);

  const savedSlugs = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const col of collections) {
      for (const slug of col.slugs) {
        if (!seen.has(slug)) {
          seen.add(slug);
          out.push(slug);
        }
      }
    }
    return out;
  }, [collections]);

  const savedSet = useMemo(() => new Set(savedSlugs), [savedSlugs]);

  const isSaved = useCallback(
    (slug: string) => savedSet.has(slug),
    [savedSet]
  );

  const isInReadLater = useCallback(
    (slug: string) => readLaterSet.has(slug),
    [readLaterSet]
  );

  const isSavedInCollection = useCallback(
    (collectionId: string, slug: string) => {
      const col = collections.find((c) => c.id === collectionId);
      return col ? col.slugs.includes(slug) : false;
    },
    [collections]
  );

  const getCollectionIdsForSlug = useCallback(
    (slug: string) =>
      collections.filter((c) => c.slugs.includes(slug)).map((c) => c.id),
    [collections]
  );

  const triggerUndoBanner = useCallback(
    (removal: PendingUndoRemoval) => {
      clearUndoTimer();
      setPendingUndo(removal);
      undoTimerRef.current = window.setTimeout(() => {
        setPendingUndo(null);
        undoTimerRef.current = null;
      }, UNDO_DURATION_MS);
    },
    [clearUndoTimer]
  );

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setPendingUndo(null);
  }, [clearUndoTimer]);

  const addToCollection = useCallback(
    (collectionId: string, slug: string) => {
      const next = collections.map((col) => {
        if (col.id !== collectionId) return col;
        if (col.slugs.includes(slug)) return col;
        return { ...col, slugs: [...col.slugs, slug] };
      });
      writeCollections(next);
    },
    [collections]
  );

  const removeFromCollection = useCallback(
    (collectionId: string, slug: string, itemTitle?: string) => {
      const target = collections.find((c) => c.id === collectionId);
      if (!target) return;
      const index = target.slugs.indexOf(slug);
      if (index === -1) return;

      const next = collections.map((col) =>
        col.id === collectionId
          ? { ...col, slugs: col.slugs.filter((s) => s !== slug) }
          : col
      );
      writeCollections(next);

      triggerUndoBanner({
        slug,
        collectionId: target.id,
        collectionName: target.name,
        index,
        label: itemTitle?.trim() || slug,
      });
    },
    [collections, triggerUndoBanner]
  );

  const undoLastRemoval = useCallback(() => {
    if (!pendingUndo) return;
    const { slug, collectionId, index } = pendingUndo;
    clearUndoTimer();
    setPendingUndo(null);

    const hasTarget = collections.some((c) => c.id === collectionId);
    const targetId = hasTarget ? collectionId : collections[0]?.id;
    if (!targetId) return;

    const next = collections.map((col) => {
      if (col.id !== targetId) return col;
      if (col.slugs.includes(slug)) return col;
      const updated = [...col.slugs];
      const insertAt = Math.min(Math.max(0, index), updated.length);
      updated.splice(insertAt, 0, slug);
      return { ...col, slugs: updated };
    });
    writeCollections(next);
  }, [pendingUndo, collections, clearUndoTimer]);

  const toggleInCollection = useCallback(
    (collectionId: string, slug: string, itemTitle?: string) => {
      const target = collections.find((c) => c.id === collectionId);
      if (!target) return;
      if (target.slugs.includes(slug)) {
        removeFromCollection(collectionId, slug, itemTitle);
      } else {
        addToCollection(collectionId, slug);
      }
    },
    [collections, addToCollection, removeFromCollection]
  );

  const toggleSaved = useCallback(
    (slug: string, itemTitle?: string) => {
      const defaultCol =
        collections.find((c) => c.id === DEFAULT_COLLECTION_ID) ??
        collections[0];
      if (!defaultCol) return;
      toggleInCollection(defaultCol.id, slug, itemTitle);
    },
    [collections, toggleInCollection]
  );

  const toggleReadLater = useCallback(
    (slug: string, itemTitle?: string) => {
      if (!readLaterCollection) {
        writeCollections([
          ...collections,
          {
            id: READ_LATER_COLLECTION_ID,
            name: READ_LATER_COLLECTION_NAME,
            slugs: [slug],
          },
        ]);
        return;
      }
      toggleInCollection(readLaterCollection.id, slug, itemTitle);
    },
    [collections, readLaterCollection, toggleInCollection]
  );

  const moveInCollection = useCallback(
    (collectionId: string, slug: string, direction: 'up' | 'down') => {
      const target = collections.find((c) => c.id === collectionId);
      if (!target) return;
      const idx = target.slugs.indexOf(slug);
      if (idx === -1) return;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= target.slugs.length) return;

      const updatedSlugs = [...target.slugs];
      [updatedSlugs[idx], updatedSlugs[swapWith]] = [
        updatedSlugs[swapWith],
        updatedSlugs[idx],
      ];

      const next = collections.map((col) =>
        col.id === collectionId ? { ...col, slugs: updatedSlugs } : col
      );
      writeCollections(next);
    },
    [collections]
  );

  const clearCollection = useCallback(
    (collectionId: string) => {
      const next = collections.map((col) =>
        col.id === collectionId ? { ...col, slugs: [] } : col
      );
      writeCollections(next);
      if (pendingUndo?.collectionId === collectionId) {
        dismissUndo();
      }
    },
    [collections, pendingUndo, dismissUndo]
  );

  const createCollection = useCallback(
    (
      rawName: string
    ): { ok: boolean; error?: string; collection?: SavedCollection } => {
      const trimmed = rawName.trim();
      if (
        trimmed.length < MIN_COLLECTION_NAME_LENGTH ||
        trimmed.length > MAX_COLLECTION_NAME_LENGTH
      ) {
        return {
          ok: false,
          error: `Collection name must be ${MIN_COLLECTION_NAME_LENGTH} to ${MAX_COLLECTION_NAME_LENGTH} characters.`,
        };
      }

      const lower = trimmed.toLowerCase();
      if (collections.some((c) => c.name.toLowerCase() === lower)) {
        return {
          ok: false,
          error: `A collection named "${trimmed}" already exists.`,
        };
      }

      const existingIds = new Set(collections.map((c) => c.id));
      const newCollection: SavedCollection = {
        id: generateCollectionId(trimmed, existingIds),
        name: trimmed,
        slugs: [],
      };
      writeCollections([...collections, newCollection]);
      return { ok: true, collection: newCollection };
    },
    [collections]
  );

  const renameCollection = useCallback(
    (id: string, rawName: string): { ok: boolean; error?: string } => {
      if (id === readLaterCollectionId) {
        return {
          ok: false,
          error: 'The built-in Read Later queue cannot be renamed.',
        };
      }

      const trimmed = rawName.trim();
      if (
        trimmed.length < MIN_COLLECTION_NAME_LENGTH ||
        trimmed.length > MAX_COLLECTION_NAME_LENGTH
      ) {
        return {
          ok: false,
          error: `Collection name must be ${MIN_COLLECTION_NAME_LENGTH} to ${MAX_COLLECTION_NAME_LENGTH} characters.`,
        };
      }

      const lower = trimmed.toLowerCase();
      if (
        collections.some((c) => c.id !== id && c.name.toLowerCase() === lower)
      ) {
        return {
          ok: false,
          error: `A collection named "${trimmed}" already exists.`,
        };
      }

      const next = collections.map((c) =>
        c.id === id ? { ...c, name: trimmed } : c
      );
      writeCollections(next);
      return { ok: true };
    },
    [collections, readLaterCollectionId]
  );

  const deleteCollection = useCallback(
    (id: string): { ok: boolean; error?: string } => {
      if (id === readLaterCollectionId) {
        return {
          ok: false,
          error: 'The built-in Read Later queue cannot be deleted.',
        };
      }
      if (collections.length <= 1) {
        return {
          ok: false,
          error: 'At least one collection must remain.',
        };
      }
      const next = collections.filter((c) => c.id !== id);
      writeCollections(next);
      if (pendingUndo?.collectionId === id) {
        dismissUndo();
      }
      return { ok: true };
    },
    [collections, readLaterCollectionId, pendingUndo, dismissUndo]
  );

  const clearSaved = useCallback(() => {
    writeCollections(
      collections.map((c) => ({ ...c, slugs: [] }))
    );
  }, [collections]);

  return {
    collections,
    savedSlugs,
    readLaterCollectionId,
    readLaterSlugs,
    storageUnavailable: snapshot.storageUnavailable,
    isSaved,
    isInReadLater,
    isSavedInCollection,
    getCollectionIdsForSlug,
    toggleSaved,
    toggleReadLater,
    addToCollection,
    removeFromCollection,
    toggleInCollection,
    moveInCollection,
    clearCollection,
    createCollection,
    renameCollection,
    deleteCollection,
    clearSaved,
    pendingUndo,
    undoLastRemoval,
    dismissUndo,
  };
}

const SavedCollectionsContext =
  createContext<SavedCollectionsContextValue | null>(null);

export function SavedCollectionsProvider({
  value,
  children,
}: {
  value: SavedCollectionsContextValue;
  children: ReactNode;
}) {
  return createElement(SavedCollectionsContext.Provider, { value }, children);
}

export function useSavedCollections(): SavedCollectionsContextValue | null {
  return useContext(SavedCollectionsContext);
}
