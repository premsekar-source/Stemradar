'use client';

import { useState } from 'react';
import { Info, Plus, Tag, X } from 'lucide-react';
import {
  MAX_FOLLOWED_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MIN_KEYWORD_LENGTH,
} from '@/hooks/use-follows';

export function StorageUnavailableNote() {
  return (
    <div
      role="note"
      className="flex items-start sm:items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-800/70 dark:border-amber-400/60 bg-amber-500/12 text-xs text-amber-950 dark:text-amber-200"
    >
      <Info
        className="w-4 h-4 shrink-0 text-amber-800 dark:text-amber-300 mt-0.5 sm:mt-0"
        aria-hidden="true"
      />
      <span>
        Browser storage is unavailable. Your followed domains and keywords are kept for this session only and won&apos;t be saved.
      </span>
    </div>
  );
}

interface KeywordsEditorProps {
  keywords: string[];
  onAddKeyword: (raw: string) => { ok: boolean; error?: string };
  onRemoveKeyword: (keyword: string) => void;
  storageUnavailable: boolean;
}

export function KeywordsEditor({
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  storageUnavailable,
}: KeywordsEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const atLimit = keywords.length >= MAX_FOLLOWED_KEYWORDS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onAddKeyword(inputValue);
    if (result.ok) {
      setInputValue('');
      setValidationError(null);
    } else {
      setValidationError(result.error ?? 'Unable to add keyword.');
    }
  };

  return (
    <section
      aria-labelledby="keywords-editor-heading"
      className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag
            className="w-4 h-4 text-[#1b4dff] dark:text-[#7da1ff] shrink-0"
            aria-hidden="true"
          />
          <h2
            id="keywords-editor-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9]"
          >
            Keywords I follow
          </h2>
        </div>
        <span className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8]">
          {keywords.length} / {MAX_FOLLOWED_KEYWORDS}
        </span>
      </div>

      {storageUnavailable && <StorageUnavailableNote />}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2.5"
        noValidate
      >
        <div className="flex-1">
          <label htmlFor="follow-keyword-input" className="sr-only">
            Add a keyword to follow ({MIN_KEYWORD_LENGTH} to {MAX_KEYWORD_LENGTH} characters)
          </label>
          <input
            id="follow-keyword-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder={`Add keyword (${MIN_KEYWORD_LENGTH}–${MAX_KEYWORD_LENGTH} chars, e.g., Starship, RISC-V)`}
            disabled={atLimit}
            aria-invalid={validationError ? 'true' : undefined}
            aria-describedby={
              validationError ? 'follow-keyword-error' : undefined
            }
            className="w-full min-h-[44px] px-3.5 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#475569] dark:placeholder:text-[#94a3b8] focus:border-[#1b4dff] dark:focus:border-[#7da1ff] disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={atLimit}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Add keyword</span>
        </button>
      </form>

      {validationError && (
        <p
          id="follow-keyword-error"
          role="alert"
          className="text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {validationError}
        </p>
      )}

      {keywords.length > 0 ? (
        <div
          role="list"
          aria-label="Followed keywords"
          className="flex flex-wrap gap-2"
        >
          {keywords.map((kw) => (
            <div key={kw} role="listitem">
              <button
                type="button"
                onClick={() => onRemoveKeyword(kw)}
                aria-label={`Remove keyword ${kw}`}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] hover:border-rose-700 dark:hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
              >
                <span>{kw}</span>
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
          No keywords followed yet. Add up to {MAX_FOLLOWED_KEYWORDS} keywords (2–30 characters) to track topics across all domains.
        </p>
      )}
    </section>
  );
}
