'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  SOURCE_STATUSES,
  type MonitoredSource,
  type SourceStatus,
} from '@/lib/types';
import { cn, formatDate, getDomainByName, isSafeHttpUrl } from '@/lib/utils';
import { DomainDot, StatusChip } from './Badges';
import { EmptyState } from './StateViews';

interface SourcesViewProps {
  sources: MonitoredSource[];
  searchQuery: string;
  onClearSearch: () => void;
}

const STATUS_LABELS: Record<SourceStatus, string> = {
  reachable: 'Reachable',
  refused: 'Refused',
  credentials: 'Credentials',
  untested: 'Untested',
};

export function SourcesView({
  sources,
  searchQuery,
  onClearSearch,
}: SourcesViewProps) {
  const [statusFilter, setStatusFilter] = useState<SourceStatus | 'all'>('all');

  const statusCounts = useMemo(() => {
    const counts: Record<SourceStatus, number> = {
      reachable: 0,
      refused: 0,
      credentials: 0,
      untested: 0,
    };
    for (const s of sources) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    }
    return counts;
  }, [sources]);

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sources.filter((source) => {
      if (statusFilter !== 'all' && source.status !== statusFilter) {
        return false;
      }
      if (q) {
        const haystack = `${source.name} ${source.domain} ${source.url} ${source.status} ${source.kind ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sources, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            Monitored Sources
          </h1>
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8] mt-1">
            Status directory of scientific portals, agencies, and research
            publishers tracked by STEM Radar.
          </p>
        </div>
        <div className="font-mono tabular-nums text-xs text-[#475569] dark:text-[#94a3b8] shrink-0">
          {sources.length} total sources
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {filteredSources.length}{' '}
        {filteredSources.length === 1 ? 'result' : 'results'}
      </div>

      {/* Status Filter Bar */}
      <div
        role="group"
        aria-label="Filter sources by status"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          aria-pressed={statusFilter === 'all'}
          className={cn(
            'min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2',
            statusFilter === 'all'
              ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
              : 'bg-white dark:bg-[#111827] text-[#334155] dark:text-[#cbd5e1] border-[#64748b] dark:border-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
          )}
        >
          <span>All</span>
          <span className="font-mono tabular-nums opacity-85">
            {sources.length}
          </span>
        </button>

        {SOURCE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            aria-pressed={statusFilter === status}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2',
              statusFilter === status
                ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] border-transparent'
                : 'bg-white dark:bg-[#111827] text-[#334155] dark:text-[#cbd5e1] border-[#64748b] dark:border-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
            )}
          >
            <span>{STATUS_LABELS[status]}</span>
            <span className="font-mono tabular-nums opacity-85">
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Sources Table */}
      {filteredSources.length === 0 ? (
        <EmptyState
          title="No sources match your filters"
          description="Try selecting another status filter or clearing the search box."
          actionLabel="Reset filters"
          onAction={() => {
            setStatusFilter('all');
            onClearSearch();
          }}
        />
      ) : (
        <div className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#7c8899] dark:border-[#5a667a] bg-[#f5f7fa]/70 dark:bg-[#0b0f1a]/60">
                  <th
                    scope="col"
                    className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
                  >
                    Source
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
                  >
                    Domain
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
                  >
                    Last Tested
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8] text-right"
                  >
                    Portal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#7c8899]/60 dark:divide-[#5a667a]/70">
                {filteredSources.map((source) => {
                  const domainInfo = getDomainByName(source.domain);
                  const safeUrl = isSafeHttpUrl(source.url);
                  return (
                    <tr
                      key={source.id}
                      className="hover:bg-[#f5f7fa]/60 dark:hover:bg-[#161f33]/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-sm text-[#0f172a] dark:text-[#f1f5f9]">
                          {source.name}
                        </div>
                        {source.kind && (
                          <div className="text-xs text-[#475569] dark:text-[#94a3b8]">
                            {source.kind}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-sm text-[#475569] dark:text-[#94a3b8]">
                          <DomainDot
                            color={domainInfo?.color ?? '#4d7cff'}
                            size="sm"
                          />
                          <span className="whitespace-nowrap">
                            {domainInfo?.name ?? source.domain}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusChip status={source.status} />
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs sm:text-sm text-[#475569] dark:text-[#94a3b8] whitespace-nowrap">
                        {source.last_tested_at
                          ? formatDate(source.last_tested_at)
                          : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {safeUrl ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-[#1b4dff] dark:text-[#7da1ff] hover:underline whitespace-nowrap"
                          >
                            <span>Visit</span>
                            <ArrowUpRight
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span className="text-xs text-[#475569] dark:text-[#94a3b8]">
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
