'use client';

import { ArrowLeft, Mail } from 'lucide-react';

function BackToDashboardLink() {
  return (
    <div>
      <a
        href="#/"
        className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1b4dff] dark:hover:text-[#7da1ff] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Dashboard</span>
      </a>
    </div>
  );
}

export function AboutView() {
  return (
    <div className="space-y-6 max-w-3xl">
      <BackToDashboardLink />

      <article className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-5">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            About STEM Radar
          </h1>
        </header>

        <div className="space-y-4 text-sm sm:text-base text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed">
          <p>
            STEM Radar is an index of recent science, technology, engineering,
            and mathematics updates organized by subject domain and source type.
          </p>
          <p>
            It is built for{' '}
            <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#7c8899]/70 dark:border-[#5a667a]/70">
              [audience]
            </span>
            .
          </p>
          <p>
            STEM Radar links directly to the original publisher, institution, or
            repository pages. It does not host or republish the underlying
            articles, papers, videos, patents, or reports.
          </p>
        </div>

        <div className="pt-4 border-t border-[#7c8899]/50 dark:border-[#5a667a]/60 flex flex-wrap gap-4 text-xs sm:text-sm">
          <a
            href="#/method"
            className="inline-flex items-center min-h-[44px] text-[#1b4dff] dark:text-[#7da1ff] hover:underline"
          >
            How it works
          </a>
          <a
            href="#/contact"
            className="inline-flex items-center min-h-[44px] text-[#1b4dff] dark:text-[#7da1ff] hover:underline"
          >
            Contact / takedown
          </a>
        </div>
      </article>
    </div>
  );
}

export function MethodView() {
  return (
    <div className="space-y-6 max-w-3xl">
      <BackToDashboardLink />

      <article className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-5">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            How it works
          </h1>
        </header>

        <ul className="space-y-3 text-sm sm:text-base text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed list-disc pl-5">
          <li>
            <strong>Automated search:</strong> Items in STEM Radar are found by
            automated search across monitored sources.
          </li>
          <li>
            <strong>Link checks:</strong> Every link is checked to make sure it
            works before the item is shown.
          </li>
          <li>
            <strong>Dates:</strong> Dates come from the source page. When a
            publication date is not available on the source page, the date the
            item was found is shown instead.
          </li>
          <li>
            <strong>Summaries:</strong> Summaries are short and written in our
            own words to describe what the source covers.
          </li>
          <li>
            <strong>Accuracy:</strong> Automated discovery can be wrong. Titles,
            summaries, dates, or domain labels may contain errors.
          </li>
        </ul>

        <div className="pt-4 border-t border-[#7c8899]/50 dark:border-[#5a667a]/60 text-sm text-[#475569] dark:text-[#94a3b8]">
          Found a broken link or an inaccurate entry?{' '}
          <a
            href="#/contact"
            className="font-medium text-[#1b4dff] dark:text-[#7da1ff] hover:underline"
          >
            Report a problem on the Contact / takedown page
          </a>
          .
        </div>
      </article>
    </div>
  );
}

export function PrivacyView() {
  return (
    <div className="space-y-6 max-w-3xl">
      <BackToDashboardLink />

      <article className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-5">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            Privacy
          </h1>
        </header>

        <ul className="space-y-3 text-sm sm:text-base text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed list-disc pl-5">
          <li>
            <strong>No accounts:</strong> You do not need an account or sign-in
            to use STEM Radar.
          </li>
          <li>
            <strong>No tracking:</strong> STEM Radar does not run user tracking
            or advertising cookies.
          </li>
          <li>
            <strong>Browser-only preferences:</strong> Your saved items,
            collections, followed domains, followed keywords, and display
            settings stay in your browser.
          </li>
          <li>
            <strong>Data host:</strong> Catalog items and source status records
            are hosted by the database provider, Supabase{' '}
            <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#7c8899]/70 dark:border-[#5a667a]/70">
              [confirm]
            </span>
            .
          </li>
        </ul>

        <p className="rounded-lg border border-amber-800/70 dark:border-amber-400/60 bg-amber-500/12 px-4 py-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
          [Review before launch: verify the database host details and any
          hosting or server logs before public release.]
        </p>
      </article>
    </div>
  );
}

interface ContactViewProps {
  reportTitle?: string;
  reportUrl?: string;
}

export function ContactView({ reportTitle, reportUrl }: ContactViewProps) {
  const hasPrefill = Boolean(reportTitle || reportUrl);

  const subject = reportTitle
    ? `STEM Radar issue report: ${reportTitle}`
    : 'STEM Radar contact / takedown request';

  const bodyLines = hasPrefill
    ? [
        `Item title: ${reportTitle ?? '[item title]'}`,
        `Item link: ${reportUrl ?? '[item link]'}`,
        'Issue type (broken link / wrong item / takedown): ',
        'Details: ',
      ]
    : [
        'Item title: ',
        'Item link: ',
        'Request type (broken link / wrong item / takedown): ',
        'Details: ',
      ];

  const mailtoHref = `mailto:[email]?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <BackToDashboardLink />

      <article className="rounded-xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9] [text-wrap:balance]">
            Contact / Takedown
          </h1>
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94a3b8]">
            There is no web form on this site. Please send reports or takedown
            requests by email.
          </p>
        </header>

        <div className="rounded-lg border border-[#7c8899]/70 dark:border-[#5a667a]/70 bg-[#f5f7fa] dark:bg-[#0b0f1a] p-4 space-y-3">
          <div className="text-sm text-[#0f172a] dark:text-[#f1f5f9]">
            Contact email:{' '}
            <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-[#111827] border border-[#7c8899]/70 dark:border-[#5a667a]/70">
              [email]
            </span>
          </div>

          {hasPrefill && (
            <div className="text-xs sm:text-sm text-[#475569] dark:text-[#94a3b8] space-y-1 pt-2 border-t border-[#7c8899]/50 dark:border-[#5a667a]/60">
              <p className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                Prefilled item details included in the email link:
              </p>
              {reportTitle && (
                <p className="break-words">
                  <span className="font-medium">Title:</span> {reportTitle}
                </p>
              )}
              {reportUrl && (
                <p className="font-mono text-xs break-all">
                  <span className="font-sans font-medium">Link:</span>{' '}
                  {reportUrl}
                </p>
              )}
            </div>
          )}

          <div>
            <a
              href={mailtoHref}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Email [email]</span>
            </a>
          </div>
        </div>

        <section aria-labelledby="what-to-include-heading" className="space-y-3">
          <h2
            id="what-to-include-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]"
          >
            What to include
          </h2>
          <ul className="space-y-3 text-sm sm:text-base text-[#0f172a] dark:text-[#e2e8f0] leading-relaxed list-disc pl-5">
            <li>
              <strong>Broken link:</strong> The item title, the link shown on
              STEM Radar, and what error or dead page you saw.
            </li>
            <li>
              <strong>Wrong item:</strong> The item title, the item link, and
              what is incorrect (such as the summary, date, domain, or source
              name).
            </li>
            <li>
              <strong>Takedown request:</strong> The item title, the original
              source URL, your connection to the source or content, and the
              reason you want the listing removed.
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
