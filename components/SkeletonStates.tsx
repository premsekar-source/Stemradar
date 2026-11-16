'use client';

export function DashboardSkeleton() {
  return (
    <div
      className="space-y-8 animate-pulse motion-reduce:animate-none"
      aria-label="Loading dashboard"
    >
      {/* Featured card skeleton */}
      <div className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 min-h-[260px] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-7 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="h-11 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-11 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* Domain tiles skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-4 min-h-[156px] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-5 w-8 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Feed skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-5 min-h-[236px] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-5 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div
      className="max-w-3xl rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 min-h-[360px] space-y-5 animate-pulse motion-reduce:animate-none"
      aria-label="Loading item details"
    >
      <div className="flex items-center gap-3">
        <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-8 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2.5 pt-2">
        <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex gap-3 pt-4">
        <div className="h-11 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-11 w-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function SourcesSkeleton() {
  return (
    <div
      className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] overflow-hidden animate-pulse motion-reduce:animate-none"
      aria-label="Loading monitored sources"
    >
      <div className="p-4 border-b border-[#7c8899] dark:border-[#5a667a] flex gap-4">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="px-4 py-4 border-b last:border-b-0 border-[#7c8899] dark:border-[#5a667a] flex items-center justify-between gap-4"
        >
          <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
