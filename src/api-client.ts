import axios, { AxiosInstance } from 'axios';

export interface RSSItem {
  id?: string;
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  author?: { name: string; avatar?: string };
  content?: string;
  'content:encoded'?: string;
  creator?: string;
  source?: string;
  sourceName?: string;
  sourceId?: string;
  images?: Array<{ url: string; alt: string }>;
  externalLink?: string;
  metadata?: string;
}

export interface FeedMetadata {
  feedId: string;
  displayName: string;
  rssUrl?: string;
  bskyHandle?: string;
  type: 'rss' | 'api' | 'bsky_profile';
  isBuiltIn: boolean;
  category: string;
  categories?: string[];
  description: string;
  defaultUpdateInterval: { value: number; unit: 'minutes' | 'hours' };
}

export interface ClipResult {
  title: string;
  markdown: string;
  url: string;
}

export interface OgImageResult {
  imageUrl: string | null;
  imageAlt?: string | null;
}

export interface NewspaperLock {
  expiry?: number;
  lockedAt?: number;
  layout?: {
    lead?: RSSItem;
    related?: RSSItem[];
    featured?: RSSItem;
    picks?: RSSItem[];
    topStories?: RSSItem[];
    latest?: RSSItem[];
    allArticleIds?: string[];
  };
  [key: string]: unknown;
}

// Maps built-in feedIds to their backend route segment
const BUILTIN_ROUTE: Record<string, string> = {
  techcrunch:   'techcrunch',
  theverge:     'theverge',
  nature:       'nature',
  statnews:     'statnews',
  bluesky:      'bluesky',
  substack:     'substack',
  endpoints:    'endpoints',
  inthepipeline:'inthepipeline',
  fiercebiotech:'fiercebiotech',
};

export class ApiClient {
  private http: AxiosInstance;

  constructor(baseURL?: string) {
    this.http = axios.create({
      baseURL: (baseURL ?? process.env.NEWS_DASHBOARD_API_URL ?? 'http://localhost:3001').replace(/\/+$/, ''),
      timeout: 30_000,
    });
  }

  // Feeds
  async getFeeds(): Promise<FeedMetadata[]> {
    const { data } = await this.http.get<FeedMetadata[]>('/feeds');
    return data;
  }

  async addFeed(displayName: string, rssUrl?: string, bskyHandle?: string, categories?: string[]): Promise<FeedMetadata> {
    const { data } = await this.http.post<FeedMetadata>('/feeds/custom', { displayName, rssUrl, bskyHandle, categories });
    return data;
  }

  async removeFeed(feedId: string): Promise<void> {
    await this.http.delete(`/feeds/custom/${feedId}`);
  }

  // Articles — fetches a single built-in or custom feed
  async getFeedArticles(feed: FeedMetadata): Promise<RSSItem[]> {
    let url: string;
    if (feed.type === 'bsky_profile' && feed.bskyHandle) {
      url = `/news/bsky-profile?handle=${encodeURIComponent(feed.bskyHandle)}`;
    } else if (!feed.isBuiltIn && feed.rssUrl) {
      url = `/news/generic?url=${encodeURIComponent(feed.rssUrl)}&source=${encodeURIComponent(feed.displayName)}`;
    } else {
      const route = BUILTIN_ROUTE[feed.feedId] ?? feed.feedId;
      url = `/news/${route}`;
    }
    const { data } = await this.http.get<RSSItem[]>(url);
    return (data ?? []).map(a => ({ ...a, sourceName: feed.displayName, sourceId: feed.feedId }));
  }

  // Newspaper lock
  async getNewspaperLock(): Promise<NewspaperLock | null> {
    const { data } = await this.http.get<NewspaperLock | null>('/newspaper/lock');
    return data;
  }

  // Article operations
  async clipArticle(url: string): Promise<ClipResult> {
    const { data } = await this.http.post<ClipResult>('/article/clip', { url }, { timeout: 60_000 });
    return data;
  }

  async summarizeText(text: string): Promise<{ summary: string }> {
    const { data } = await this.http.post<{ summary: string }>('/summarize', { text }, { timeout: 60_000 });
    return data;
  }

  async getOgImage(url: string): Promise<OgImageResult> {
    const { data } = await this.http.get<OgImageResult>(`/article/ogimage?url=${encodeURIComponent(url)}`);
    return data;
  }

  // BlueSky
  async postToBluesky(opts: {
    text: string;
    identifier: string;
    password: string;
    articleUrl?: string;
    articleTitle?: string;
    articleDescription?: string;
    imageUrl?: string;
  }): Promise<{ success: boolean; postUri?: string }> {
    const { data } = await this.http.post('/article/bluesky', opts, { timeout: 45_000 });
    return data;
  }

  // Settings
  async getSettings(): Promise<Record<string, unknown> | null> {
    const { data } = await this.http.get<Record<string, unknown> | null>('/settings');
    return data;
  }

  async patchSettings(patch: Record<string, unknown>): Promise<void> {
    await this.http.patch('/settings', patch);
  }
}
