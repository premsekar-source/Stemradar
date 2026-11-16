export type DiscoveryType =
  | 'News'
  | 'Mission'
  | 'Paper'
  | 'Video'
  | 'Report'
  | 'Patent';

export const DISCOVERY_TYPES: readonly DiscoveryType[] = [
  'News',
  'Mission',
  'Paper',
  'Video',
  'Report',
  'Patent',
] as const;

export type SourceStatus =
  | 'reachable'
  | 'refused'
  | 'credentials'
  | 'untested';

export const SOURCE_STATUSES: readonly SourceStatus[] = [
  'reachable',
  'refused',
  'credentials',
  'untested',
] as const;

export interface DomainInfo {
  slug: string;
  name: string;
  shortName: string;
  color: string;
  description: string;
}

export { DOMAINS } from '@/data/domains';

export interface Discovery {
  slug: string;
  domain: string;
  /** Real content type string preserved as-is from the data source */
  type: string;
  title: string;
  summary: string;
  source: string;
  published_at: string | null;
  url: string;
  url_kind: string;
  significant: boolean;
  discovered_at: string;
  last_verified_at?: string | null;
}

export interface MonitoredSource {
  id: string;
  name: string;
  domain: string;
  url: string;
  status: SourceStatus;
  last_tested_at: string | null;
  kind?: string;
}

export type SortOrder = 'newest' | 'significant';

export interface DiscoveryQueryOptions {
  /** Domain slug or exact domain name, or 'all' */
  domain?: string;
  type?: string;
  search?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface DiscoveryPage {
  items: Discovery[];
  totalCount: number | null;
  hasMore: boolean;
}

export interface RadarService {
  readonly mode: 'live' | 'sample';
  listDiscoveries(options?: DiscoveryQueryOptions): Promise<DiscoveryPage>;
  getDiscoveryBySlug(slug: string): Promise<Discovery | null>;
  listDomainCounts(): Promise<Record<string, number>>;
  listSources(): Promise<MonitoredSource[]>;
}
