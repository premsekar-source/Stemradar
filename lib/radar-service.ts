import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DOMAINS,
  SOURCE_STATUSES,
  type Discovery,
  type DiscoveryPage,
  type DiscoveryQueryOptions,
  type MonitoredSource,
  type RadarService,
  type SourceStatus,
} from './types';
import { SAMPLE_DISCOVERIES, SAMPLE_SOURCES } from './sample-data';
import { getDomainByName, getDomainBySlug, sortDiscoveries } from './utils';

export const DISCOVERIES_PAGE_SIZE = 30;

function preserveDiscoveryType(raw: unknown): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return 'Unknown';
}

function normalizeSourceStatus(raw: unknown): SourceStatus {
  if (typeof raw === 'string') {
    const matched = SOURCE_STATUSES.find(
      (s) => s.toLowerCase() === raw.trim().toLowerCase()
    );
    if (matched) return matched;
  }
  return 'untested';
}

function resolveDomainNameFilter(domainOption?: string): string | null {
  if (!domainOption || domainOption === 'all') return null;
  const bySlug = getDomainBySlug(domainOption);
  if (bySlug) return bySlug.name;
  const byName = getDomainByName(domainOption);
  if (byName) return byName.name;
  return domainOption;
}

export function filterAndPaginateLocalDiscoveries(
  allItems: readonly Discovery[],
  options: DiscoveryQueryOptions = {}
): DiscoveryPage {
  const limit = options.limit ?? DISCOVERIES_PAGE_SIZE;
  const offset = options.offset ?? 0;
  const sort = options.sort ?? 'newest';
  const domainFilter = resolveDomainNameFilter(options.domain);
  const typeFilter =
    options.type && options.type !== 'all'
      ? options.type.trim().toLowerCase()
      : null;
  const searchTerm = options.search?.trim().toLowerCase() ?? '';

  const filtered = allItems.filter((item) => {
    if (domainFilter) {
      const itemDomain = getDomainByName(item.domain)?.name ?? item.domain;
      if (itemDomain.toLowerCase() !== domainFilter.toLowerCase()) return false;
    }
    if (typeFilter && item.type.trim().toLowerCase() !== typeFilter) {
      return false;
    }
    if (searchTerm) {
      const titleMatch = item.title.toLowerCase().includes(searchTerm);
      const summaryMatch = item.summary.toLowerCase().includes(searchTerm);
      if (!titleMatch && !summaryMatch) return false;
    }
    return true;
  });

  const sorted = sortDiscoveries(filtered, sort);
  const pageItems = sorted.slice(offset, offset + limit);

  return {
    items: pageItems,
    totalCount: sorted.length,
    hasMore: offset + pageItems.length < sorted.length,
  };
}

function mapSupabaseDiscovery(row: Record<string, unknown>): Discovery {
  return {
    slug: String(row.slug ?? ''),
    domain: String(row.domain ?? 'Emerging STEM Innovations'),
    type: preserveDiscoveryType(row.type),
    title: String(row.title ?? 'Untitled Discovery'),
    summary: String(row.summary ?? ''),
    source: String(row.source ?? 'Unknown source'),
    published_at: row.published_at ? String(row.published_at) : null,
    url: String(row.url ?? ''),
    url_kind: String(row.url_kind ?? 'external'),
    significant: Boolean(row.significant),
    discovered_at: String(row.discovered_at ?? new Date().toISOString()),
    last_verified_at: row.last_verified_at
      ? String(row.last_verified_at)
      : null,
  };
}

export class SupabaseRadarService implements RadarService {
  readonly mode = 'live' as const;
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async listDiscoveries(
    options: DiscoveryQueryOptions = {}
  ): Promise<DiscoveryPage> {
    const limit = options.limit ?? DISCOVERIES_PAGE_SIZE;
    const offset = options.offset ?? 0;
    const sort = options.sort ?? 'newest';
    const domainFilter = resolveDomainNameFilter(options.domain);
    const typeFilter =
      options.type && options.type !== 'all' ? options.type.trim() : null;
    const rawSearch = options.search?.trim() ?? '';

    let query = this.client
      .from('discoveries')
      .select(
        'slug, domain, type, title, summary, source, published_at, url, url_kind, significant, discovered_at, last_verified_at',
        { count: 'exact' }
      );

    if (domainFilter) {
      query = query.eq('domain', domainFilter);
    }

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    if (rawSearch.length > 0) {
      const sanitized = rawSearch.replace(/[,()]/g, ' ').trim();
      if (sanitized.length > 0) {
        query = query.or(`title.ilike.%${sanitized}%,summary.ilike.%${sanitized}%`);
      }
    }

    // Order by discovered_at first in SQL so rows with null published_at are never buried,
    // then refine ordering client-side by published_at || discovered_at.
    if (sort === 'significant') {
      query = query
        .order('significant', { ascending: false })
        .order('discovered_at', { ascending: false });
    } else {
      query = query.order('discovered_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(
        `Unable to load discoveries from Supabase: ${error.message}`
      );
    }

    const mapped = (data ?? []).map((row) =>
      mapSupabaseDiscovery(row as Record<string, unknown>)
    );
    const items = sortDiscoveries(mapped, sort);
    const totalCount = typeof count === 'number' ? count : null;
    const hasMore =
      totalCount !== null
        ? offset + items.length < totalCount
        : items.length === limit;

    return { items, totalCount, hasMore };
  }

  async getDiscoveryBySlug(slug: string): Promise<Discovery | null> {
    const { data, error } = await this.client
      .from('discoveries')
      .select(
        'slug, domain, type, title, summary, source, published_at, url, url_kind, significant, discovered_at, last_verified_at'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load discovery from Supabase: ${error.message}`
      );
    }

    return data
      ? mapSupabaseDiscovery(data as Record<string, unknown>)
      : null;
  }

  async listDomainCounts(): Promise<Record<string, number>> {
    const entries = await Promise.all(
      DOMAINS.map(async (domain) => {
        const { count, error } = await this.client
          .from('discoveries')
          .select('slug', { count: 'exact', head: true })
          .eq('domain', domain.name);

        if (error) {
          throw new Error(
            `Unable to count discoveries for ${domain.name}: ${error.message}`
          );
        }
        return [domain.slug, count ?? 0] as const;
      })
    );

    return Object.fromEntries(entries);
  }

  async listSources(): Promise<MonitoredSource[]> {
    const { data, error } = await this.client
      .from('sources')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Unable to load sources from Supabase: ${error.message}`);
    }

    return (data ?? []).map((row, index) => ({
      id: String(row.id ?? row.name ?? `source-${index}`),
      name: String(row.name ?? 'Unnamed Source'),
      domain: String(row.domain ?? 'Scientific Research & Journals'),
      url: String(row.url ?? ''),
      status: normalizeSourceStatus(row.status),
      last_tested_at: row.last_tested_at ? String(row.last_tested_at) : null,
      kind: row.kind ? String(row.kind) : undefined,
    }));
  }
}

export class SampleRadarService implements RadarService {
  readonly mode = 'sample' as const;

  async listDiscoveries(
    options: DiscoveryQueryOptions = {}
  ): Promise<DiscoveryPage> {
    await new Promise((resolve) => setTimeout(resolve, 140));
    return filterAndPaginateLocalDiscoveries(SAMPLE_DISCOVERIES, options);
  }

  async getDiscoveryBySlug(slug: string): Promise<Discovery | null> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return SAMPLE_DISCOVERIES.find((d) => d.slug === slug) ?? null;
  }

  async listDomainCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const d of DOMAINS) counts[d.slug] = 0;
    for (const item of SAMPLE_DISCOVERIES) {
      const info = getDomainByName(item.domain);
      if (info) counts[info.slug] = (counts[info.slug] ?? 0) + 1;
    }
    return counts;
  }

  async listSources(): Promise<MonitoredSource[]> {
    await new Promise((resolve) => setTimeout(resolve, 140));
    return [...SAMPLE_SOURCES];
  }
}

export function hasSupabaseEnvVars(): boolean {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return url.trim().length > 0 && anonKey.trim().length > 0;
}

export function createRadarService(): RadarService {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (url.trim().length > 0 && anonKey.trim().length > 0) {
    return new SupabaseRadarService(url.trim(), anonKey.trim());
  }
  return new SampleRadarService();
}
