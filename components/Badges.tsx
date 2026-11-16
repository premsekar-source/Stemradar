'use client';

import {
  CheckCircle2,
  Clock,
  Database,
  KeyRound,
  Radio,
  Star,
  XCircle,
} from 'lucide-react';
import type { SourceStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function DomainDot({
  color,
  size = 'md',
}: {
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block rounded-full shrink-0', sizeClass)}
      style={{ backgroundColor: color }}
    />
  );
}

const KNOWN_TYPE_STYLES: Record<string, string> = {
  news: 'bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-700/70 dark:border-sky-400/60',
  mission:
    'bg-violet-500/12 text-violet-800 dark:text-violet-300 border-violet-700/70 dark:border-violet-400/60',
  paper:
    'bg-indigo-500/12 text-indigo-800 dark:text-indigo-300 border-indigo-700/70 dark:border-indigo-400/60',
  video:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-800/70 dark:border-amber-400/60',
  report:
    'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-700/70 dark:border-emerald-400/60',
  patent:
    'bg-orange-500/12 text-orange-800 dark:text-orange-300 border-orange-700/70 dark:border-orange-400/60',
};

const FALLBACK_TYPE_STYLE =
  'bg-slate-500/12 text-slate-800 dark:text-slate-300 border-[#64748b] dark:border-[#64748b]';

export function TypeChip({ type }: { type: string }) {
  const key = type.trim().toLowerCase();
  const style = KNOWN_TYPE_STYLES[key] ?? FALLBACK_TYPE_STYLE;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0',
        style
      )}
    >
      {type}
    </span>
  );
}

const STATUS_META: Record<
  SourceStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  reachable: {
    label: 'Reachable',
    className:
      'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-700/70 dark:border-emerald-400/60',
    Icon: CheckCircle2,
  },
  refused: {
    label: 'Refused',
    className:
      'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-700/70 dark:border-rose-400/60',
    Icon: XCircle,
  },
  credentials: {
    label: 'Credentials',
    className:
      'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-800/70 dark:border-amber-400/60',
    Icon: KeyRound,
  },
  untested: {
    label: 'Untested',
    className:
      'bg-slate-500/12 text-slate-800 dark:text-slate-300 border-[#64748b] dark:border-[#64748b]',
    Icon: Clock,
  },
};

export function StatusChip({ status }: { status: SourceStatus }) {
  const { label, className, Icon } = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0',
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function DataModePill({ mode }: { mode: 'live' | 'sample' }) {
  const isLive = mode === 'live';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap shrink-0',
        isLive
          ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-700/70 dark:border-emerald-400/60'
          : 'bg-[#1b4dff]/10 text-[#1b4dff] dark:bg-[#4d7cff]/15 dark:text-[#8eb0ff] border-[#1b4dff]/70 dark:border-[#7da1ff]/65'
      )}
      title={
        isLive
          ? 'Connected to live read-only Supabase dataset'
          : 'Using built-in sample directory entries'
      }
    >
      {isLive ? (
        <Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Database className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{isLive ? 'Live data' : 'Sample data'}</span>
    </span>
  );
}

export function SignificantBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0">
      <Star className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
      <span>Significant</span>
    </span>
  );
}

export function NewBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#1b4dff]/12 text-[#1b4dff] dark:bg-[#4d7cff]/20 dark:text-[#8eb0ff] border border-[#1b4dff]/70 dark:border-[#7da1ff]/65 whitespace-nowrap shrink-0">
      New
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const trimmed = source.trim();
  const firstChar = trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold uppercase bg-[#eef2f7] dark:bg-[#1e293b] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] shrink-0 select-none"
    >
      {firstChar}
    </span>
  );
}
