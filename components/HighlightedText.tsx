'use client';

import { Fragment } from 'react';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightedText({
  text,
  keywords,
}: {
  text: string;
  keywords?: readonly string[];
}) {
  if (!keywords || keywords.length === 0 || !text) {
    return <>{text}</>;
  }

  const normalized = Array.from(
    new Set(
      keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    )
  ).sort((a, b) => b.length - a.length);

  if (normalized.length === 0) {
    return <>{text}</>;
  }

  const lowerSet = new Set(normalized.map((k) => k.toLowerCase()));
  const pattern = new RegExp(`(${normalized.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (lowerSet.has(part.toLowerCase())) {
          return (
            <mark
              key={idx}
              className="bg-[#1b4dff]/15 dark:bg-[#4d7cff]/25 text-[#0f172a] dark:text-[#f1f5f9] rounded px-0.5 font-semibold"
            >
              {part}
            </mark>
          );
        }
        return <Fragment key={idx}>{part}</Fragment>;
      })}
    </>
  );
}
