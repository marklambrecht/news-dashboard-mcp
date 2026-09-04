import axios, { AxiosInstance } from 'axios';

export interface RSSItem {
  id?: string;
  title: string;
  link: string;
  description: string;
  pubDate?: string | null;
  author?: { name: string; avatar?: string };
  content?: string;
  'content:encoded'?: string;
  creator?: string;
  source?: string;
  sourceName?: string;
  sourceId?: string;
  images?: Array<{ url: string; alt: string }>;
  externalLink?: string;
  scraped?: boolean;
  metadata?: string;
}

export interface FeedMetadata {
  feedId: string;
  displayName: string;
  rssUrl?: string;
  bskyHandle?: string;
  type: 'rss' | 'bsky_profile';
  category: string;
  categories?: string[];
  description: string;
  defaultUpdateInterval: { value: number; unit: 'minutes' | 'hours' };
  icon?: string;
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

export interface ReadabilityResult {
  content: string | null;
  title: string | null;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  description: string | null;
  paywall: boolean;
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

// Minimal article shape accepted by the AI-generation endpoints (morning edition,
// intelligence, digests, newsletters). Extra RSSItem fields are ignored server-side.
export interface ArticleInput {
  title: string;
  link?: string;
  description?: string;
  sourceName?: string;
  source?: string;
  category?: string;
  pubDate?: string;
  note?: string;
  [key: string]: unknown;
}

export class ApiClient {
  private http: AxiosInstance;

  constructor(baseURL?: string) {
    const token = process.env.NEWS_DASHBOARD_TOKEN;
    this.http = axios.create({
      baseURL: (baseURL ?? process.env.NEWS_DASHBOARD_API_URL ?? 'http://localhost:3001').replace(/\/+$/, ''),
      timeout: 30_000,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    // The backend requires a JWT on almost every route. Turn a bare 401 into
    // an actionable message instead of a cryptic axios error, since there is
    // no refresh flow here — a pre-issued token is supplied via env var and
    // must be replaced manually once it expires or is rejected.
    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          const message = token
            ? 'The backend rejected NEWS_DASHBOARD_TOKEN (401 Unauthorized). It may have expired — log into the news dashboard again and copy a fresh accessToken from POST /auth/login into the MCP server config.'
            : 'The backend requires authentication (401 Unauthorized) and NEWS_DASHBOARD_TOKEN is not set. Obtain an accessToken via POST /auth/login and set it in the MCP server config.';
          return Promise.reject(new Error(message));
        }
        return Promise.reject(err);
      },
    );
  }

  // ── Feeds ──────────────────────────────────────────────────────────────────
  async getFeeds(): Promise<FeedMetadata[]> {
    const { data } = await this.http.get<FeedMetadata[]>('/feeds');
    return data;
  }

  async addFeed(displayName: string, rssUrl?: string, bskyHandle?: string, categories?: string[], icon?: string): Promise<FeedMetadata> {
    const { data } = await this.http.post<FeedMetadata>('/feeds/custom', { displayName, rssUrl, bskyHandle, categories, icon });
    return data;
  }

  async renameFeed(feedId: string, displayName?: string, icon?: string, rssUrl?: string): Promise<FeedMetadata> {
    const { data } = await this.http.patch<FeedMetadata>(`/feeds/custom/${encodeURIComponent(feedId)}`, { displayName, icon, rssUrl });
    return data;
  }

  async removeFeed(feedId: string): Promise<void> {
    await this.http.delete(`/feeds/custom/${encodeURIComponent(feedId)}`);
  }

  // Fetches a single feed's articles — dispatches by feed type since the backend
  // no longer has per-source built-in routes (e.g. /news/techcrunch); everything
  // is either a generic RSS/Atom pull or a BlueSky profile feed.
  async getFeedArticles(feed: FeedMetadata): Promise<RSSItem[]> {
    let url: string;
    if (feed.type === 'bsky_profile' && feed.bskyHandle) {
      url = `/news/bsky-profile?handle=${encodeURIComponent(feed.bskyHandle)}`;
    } else if (feed.rssUrl) {
      url = `/news/generic?url=${encodeURIComponent(feed.rssUrl)}&source=${encodeURIComponent(feed.displayName)}`;
    } else {
      return [];
    }
    const { data } = await this.http.get<RSSItem[]>(url);
    return (data ?? []).map(a => ({ ...a, sourceName: feed.displayName, sourceId: feed.feedId }));
  }

  // Fetches many feeds in one request — mirrors the frontend's parallel-loading path.
  async getBulkFeeds(feeds: FeedMetadata[], maxArticles = 10): Promise<Record<string, RSSItem[]>> {
    const body = {
      feeds: feeds.map(f => ({ feedId: f.feedId, type: f.type, rssUrl: f.rssUrl, bskyHandle: f.bskyHandle })),
      maxArticles,
    };
    const { data } = await this.http.post<Record<string, RSSItem[]>>('/feeds/bulk', body);
    return data;
  }

  // Newspaper lock (front-page layout)
  async getNewspaperLock(): Promise<NewspaperLock | null> {
    const { data } = await this.http.get<NewspaperLock | null>('/newspaper/lock');
    return data;
  }

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  async getBookmarks(): Promise<RSSItem[]> {
    const { data } = await this.http.get<RSSItem[]>('/bookmarks');
    return data;
  }

  async addBookmark(article: Record<string, unknown>): Promise<{ bookmarkId: string }> {
    const { data } = await this.http.post<{ bookmarkId: string }>('/bookmarks', article);
    return data;
  }

  async updateBookmark(bookmarkId: string, updates: Record<string, unknown>): Promise<void> {
    await this.http.patch(`/bookmarks/${encodeURIComponent(bookmarkId)}`, updates);
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    await this.http.delete(`/bookmarks/${encodeURIComponent(bookmarkId)}`);
  }

  // ── Article operations ───────────────────────────────────────────────────────
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

  async getReadability(url: string): Promise<ReadabilityResult> {
    const { data } = await this.http.get<ReadabilityResult>(`/article/readability?url=${encodeURIComponent(url)}`, { timeout: 45_000 });
    return data;
  }

  async translateArticle(text: string, url?: string): Promise<{ translation: string }> {
    const { data } = await this.http.post<{ translation: string }>('/article/translate', { text, url }, { timeout: 60_000 });
    return data;
  }

  // ── Morning Edition (daily AI magazine) ───────────────────────────────────────
  async getMorningEdition(): Promise<{ html: string | null; generatedAt: string | null }> {
    const { data } = await this.http.get('/morning-edition');
    return data;
  }

  async getMorningEditionStories(): Promise<unknown> {
    const { data } = await this.http.get('/morning-edition/stories');
    return data;
  }

  // Step 1/2 of the two-step pipeline: curate top stories from the supplied
  // articles, then render the cached selection into HTML.
  async curateMorningEdition(articles: ArticleInput[], force = false): Promise<{ storyCount: number }> {
    const { data } = await this.http.post('/morning-edition/curate', { articles, force }, { timeout: 60_000 });
    return data;
  }

  async buildMorningEdition(): Promise<{ html: string; generatedAt: string }> {
    const { data } = await this.http.post('/morning-edition/build', {}, { timeout: 60_000 });
    return data;
  }

  async getMorningEditionHistory(): Promise<unknown[]> {
    const { data } = await this.http.get('/morning-edition/history');
    return data;
  }

  async sendMorningEditionEmail(): Promise<{ sent: boolean; to?: string }> {
    const { data } = await this.http.post('/morning-edition/send-email');
    return data;
  }

  // ── Weekly digest ────────────────────────────────────────────────────────────
  async getWeeklyDigest(): Promise<{ html: string | null; generatedAt: string | null }> {
    const { data } = await this.http.get('/weekly-digest');
    return data;
  }

  async generateWeeklyDigest(articles: ArticleInput[], force = false): Promise<unknown> {
    const { data } = await this.http.post('/weekly-digest/generate', { articles, force }, { timeout: 60_000 });
    return data;
  }

  async getWeeklyDigestHistory(): Promise<unknown[]> {
    const { data } = await this.http.get('/weekly-digest/history');
    return data;
  }

  // ── Simple digest (lightweight alternative to Morning Edition) ────────────────
  async generateDigest(articles: ArticleInput[], force = false): Promise<{ digest: string; writtenAt: string; sources: unknown[] }> {
    const { data } = await this.http.post('/digest', { articles, force }, { timeout: 60_000 });
    return data;
  }

  // ── Intelligence (per-category AI briefings + Q&A) ────────────────────────────
  async getIntelligence(category: string): Promise<unknown> {
    const { data } = await this.http.get(`/intelligence?category=${encodeURIComponent(category)}`);
    return data;
  }

  async refreshIntelligence(
    category: string,
    articles?: ArticleInput[],
    force = false,
  ): Promise<unknown> {
    const { data } = await this.http.post(
      '/intelligence/refresh',
      { category, articles, categories: [{ id: category, label: category }], force },
      { timeout: 60_000 },
    );
    return data;
  }

  async askNews(
    question: string,
    articles: Array<{ index: number; title: string; description: string; sourceName: string; pubDate: string; link: string }>,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<{ answer: string }> {
    const { data } = await this.http.post('/ask-news', { question, articles, history }, { timeout: 60_000 });
    return data;
  }

  async threadSummary(keywords: string[], articles: Array<{ title: string; sourceName: string; pubDate: string }>): Promise<{ summary: string }> {
    const { data } = await this.http.post('/thread-summary', { keywords, articles }, { timeout: 60_000 });
    return data;
  }

  async generateNewsletter(articles: ArticleInput[]): Promise<unknown> {
    const { data } = await this.http.post('/intelligence/newsletter', { articles }, { timeout: 60_000 });
    return data;
  }

  async generateNewsletterImage(title: string, articleTitles: string[]): Promise<{ imageUrl: string | null }> {
    const { data } = await this.http.post('/intelligence/newsletter-image', { title, articleTitles }, { timeout: 60_000 });
    return data;
  }

  async generateLinkedInPost(articles: ArticleInput[]): Promise<unknown> {
    const { data } = await this.http.post('/intelligence/linkedin-post', { articles }, { timeout: 60_000 });
    return data;
  }

  // ── BlueSky ──────────────────────────────────────────────────────────────────
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

  // ── Settings ─────────────────────────────────────────────────────────────────
  async getSettings(): Promise<Record<string, unknown> | null> {
    const { data } = await this.http.get<Record<string, unknown> | null>('/settings');
    return data;
  }

  async patchSettings(patch: Record<string, unknown>): Promise<void> {
    await this.http.patch('/settings', patch);
  }
}
