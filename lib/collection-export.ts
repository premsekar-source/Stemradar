import type { Discovery } from './types';
import { formatDiscoveryDate, isSafeHttpUrl } from './utils';

export type ExportFormat = 'text' | 'csv' | 'markdown';

export interface ExportableItem {
  slug: string;
  title: string;
  source: string;
  date: string;
  link: string;
}

export function resolveExportItems(
  slugs: readonly string[],
  discoveryMap: ReadonlyMap<string, Discovery>
): ExportableItem[] {
  return slugs.map((slug) => {
    const item = discoveryMap.get(slug);
    if (!item) {
      return {
        slug,
        title: `No longer available (${slug})`,
        source: 'Unavailable',
        date: 'Unavailable',
        link: '',
      };
    }

    const dateInfo = formatDiscoveryDate(item.published_at, item.discovered_at);
    return {
      slug,
      title: item.title,
      source: item.source,
      date: dateInfo.label,
      link: isSafeHttpUrl(item.url) ? item.url : '',
    };
  });
}

export function escapeCsvField(value: string): string {
  const normalized = String(value ?? '');
  const escaped = normalized.replace(/"/g, '""');
  if (/[",\r\n]/.test(normalized)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function formatCollectionAsText(
  collectionName: string,
  items: readonly ExportableItem[]
): string {
  const header = `${collectionName} (${items.length} ${items.length === 1 ? 'item' : 'items'})`;
  if (items.length === 0) return header;

  const lines = items.map((item, idx) => {
    const linkLine = item.link ? item.link : 'Unavailable';
    return `${idx + 1}. ${item.title}\n   Source: ${item.source} | Date: ${item.date}\n   Link: ${linkLine}`;
  });

  return `${header}\n\n${lines.join('\n\n')}`;
}

export function formatCollectionAsCsv(
  items: readonly ExportableItem[]
): string {
  const headerRow = ['Title', 'Source', 'Date', 'Link'].join(',');
  const dataRows = items.map((item) =>
    [
      escapeCsvField(item.title),
      escapeCsvField(item.source),
      escapeCsvField(item.date),
      escapeCsvField(item.link),
    ].join(',')
  );

  return [headerRow, ...dataRows].join('\r\n');
}

function escapeMarkdownLinkLabel(label: string): string {
  return label.replace(/[\r\n]+/g, ' ').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

export function formatCollectionAsMarkdown(
  collectionName: string,
  items: readonly ExportableItem[]
): string {
  const heading = `# ${collectionName}`;
  if (items.length === 0) return heading;

  const bullets = items.map((item) => {
    const cleanTitle = escapeMarkdownLinkLabel(item.title);
    const titlePart = item.link ? `[${cleanTitle}](${item.link})` : cleanTitle;
    return `- ${titlePart} — ${item.source} (${item.date})`;
  });

  return `${heading}\n\n${bullets.join('\n')}`;
}

export function formatCollectionExport(
  format: ExportFormat,
  collectionName: string,
  items: readonly ExportableItem[]
): string {
  switch (format) {
    case 'text':
      return formatCollectionAsText(collectionName, items);
    case 'csv':
      return formatCollectionAsCsv(items);
    case 'markdown':
      return formatCollectionAsMarkdown(collectionName, items);
  }
}

export function getExportFileMeta(
  format: ExportFormat,
  collectionName: string
): { filename: string; mimeType: string } {
  const safeBase =
    collectionName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'collection';

  switch (format) {
    case 'text':
      return {
        filename: `stem-radar-${safeBase}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      };
    case 'csv':
      return {
        filename: `stem-radar-${safeBase}.csv`,
        mimeType: 'text/csv;charset=utf-8',
      };
    case 'markdown':
      return {
        filename: `stem-radar-${safeBase}.md`,
        mimeType: 'text/markdown;charset=utf-8',
      };
  }
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
