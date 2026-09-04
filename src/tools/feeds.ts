import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, RSSItem } from '../api-client.js';

function dedupeSorted(articles: RSSItem[], limit: number): RSSItem[] {
  const seen = new Set<string>();
  const unique = articles.filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  unique.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });
  return unique.slice(0, limit);
}

export function registerFeedTools(server: McpServer, api: ApiClient): void {

  // ── list_feeds ──────────────────────────────────────────────────────────
  server.tool(
    'list_feeds',
    'List all of the signed-in user\'s configured feeds (RSS/Atom and BlueSky profile feeds) with their IDs, display names, types, and categories.',
    {},
    async () => {
      const feeds = await api.getFeeds();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(feeds, null, 2),
        }],
      };
    },
  );

  // ── get_articles ─────────────────────────────────────────────────────────
  server.tool(
    'get_articles',
    'Fetch articles from a specific feed or from all feeds. Returns articles sorted newest-first. ' +
    'Use list_feeds first to see available feedIds.',
    {
      feedId: z.string().optional().describe(
        'Feed ID to fetch (from list_feeds). Omit to fetch all configured feeds.',
      ),
      limit: z.number().int().min(1).max(200).optional().describe(
        'Maximum number of articles to return (default: 20).',
      ),
    },
    async ({ feedId, limit = 20 }) => {
      const feeds = await api.getFeeds();

      const targetFeeds = feedId
        ? feeds.filter(f => f.feedId === feedId)
        : feeds;

      if (targetFeeds.length === 0) {
        return { content: [{ type: 'text', text: `No feed found with id "${feedId}". Call list_feeds to see available IDs.` }], isError: true };
      }

      // Use the bulk endpoint when pulling everything — one round trip instead of N.
      let articles: RSSItem[];
      if (!feedId && targetFeeds.length > 1) {
        const byFeed = await api.getBulkFeeds(targetFeeds, Math.max(limit, 10));
        articles = Object.values(byFeed).flat();
      } else {
        const results = await Promise.allSettled(targetFeeds.map(f => api.getFeedArticles(f)));
        articles = [];
        for (const r of results) {
          if (r.status === 'fulfilled') articles.push(...r.value);
        }
      }

      const sliced = dedupeSorted(articles, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(sliced, null, 2),
        }],
      };
    },
  );

  // ── get_top_stories ───────────────────────────────────────────────────────
  server.tool(
    'get_top_stories',
    'Get the current newspaper front-page layout: hero article, related stories, featured, editor\'s picks, ' +
    'top stories grid, and latest articles. This is the same curated layout the web app\'s "Today" view shows.',
    {},
    async () => {
      const lock = await api.getNewspaperLock();
      if (!lock) {
        return {
          content: [{ type: 'text', text: 'No newspaper layout is currently locked. The layout refreshes automatically every ~20 minutes as the app is used — try get_articles instead for raw feed data.' }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(lock, null, 2),
        }],
      };
    },
  );

  // ── find_articles_by_topic ────────────────────────────────────────────────
  server.tool(
    'find_articles_by_topic',
    'Search for articles matching a topic or keyword across all feeds (or a specific set of feeds). ' +
    'Returns matches sorted by relevance then recency. There is no server-side search index — this fetches ' +
    'the raw feeds and matches client-side, so it only covers each feed\'s current items.',
    {
      query: z.string().min(1).describe('Search query — keywords or topic phrase.'),
      feedIds: z.array(z.string()).optional().describe(
        'Restrict search to these feed IDs. Omit to search all feeds.',
      ),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default: 15).'),
    },
    async ({ query, feedIds, limit = 15 }) => {
      const feeds = await api.getFeeds();
      const targetFeeds = feedIds ? feeds.filter(f => feedIds.includes(f.feedId)) : feeds;

      const byFeed = await api.getBulkFeeds(targetFeeds, 25);
      const articles = Object.values(byFeed).flat();

      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = articles
        .map(a => {
          const haystack = `${a.title} ${a.description} ${a.content ?? ''}`.toLowerCase();
          const score = words.reduce((n, w) => {
            const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            return n + (haystack.match(re)?.length ?? 0);
          }, 0);
          return { ...a, relevanceScore: score };
        })
        .filter(a => a.relevanceScore > 0)
        .sort((a, b) => {
          if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
          return (Date.parse(b.pubDate ?? '0')) - (Date.parse(a.pubDate ?? '0'));
        });

      const deduped: typeof scored = [];
      const seen = new Set<string>();
      for (const a of scored) {
        if (!seen.has(a.link)) { seen.add(a.link); deduped.push(a); }
      }

      const sliced = deduped.slice(0, limit);
      return {
        content: [{
          type: 'text',
          text: sliced.length > 0
            ? JSON.stringify(sliced, null, 2)
            : `No articles found matching "${query}".`,
        }],
      };
    },
  );

  // ── add_feed ──────────────────────────────────────────────────────────────
  server.tool(
    'add_feed',
    'Add a new custom feed. Provide either an RSS URL or a BlueSky handle (not both).',
    {
      displayName: z.string().min(1).describe('Human-readable name shown in the sidebar.'),
      rssUrl: z.string().url().optional().describe('RSS/Atom feed URL for an RSS feed.'),
      bskyHandle: z.string().optional().describe(
        'BlueSky handle for a profile feed, e.g. "economist.com" or "@economist.com".',
      ),
      categories: z.array(z.string()).optional().describe(
        'Category IDs to assign, e.g. ["biotech", "science"]. Defaults to ["general"].',
      ),
    },
    async ({ displayName, rssUrl, bskyHandle, categories }) => {
      if (!rssUrl && !bskyHandle) {
        return { content: [{ type: 'text', text: 'Provide either rssUrl or bskyHandle.' }], isError: true };
      }
      const feed = await api.addFeed(displayName, rssUrl, bskyHandle, categories);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(feed, null, 2),
        }],
      };
    },
  );

  // ── rename_feed ───────────────────────────────────────────────────────────
  server.tool(
    'rename_feed',
    'Rename a custom feed, change its icon, or update its RSS URL.',
    {
      feedId: z.string().min(1).describe('The feedId of the custom feed to update.'),
      displayName: z.string().optional().describe('New display name.'),
      icon: z.string().optional().describe('New icon.'),
      rssUrl: z.string().url().optional().describe('New RSS/Atom URL.'),
    },
    async ({ feedId, displayName, icon, rssUrl }) => {
      if (!displayName && !icon && !rssUrl) {
        return { content: [{ type: 'text', text: 'Provide at least one of displayName, icon, or rssUrl.' }], isError: true };
      }
      const feed = await api.renameFeed(feedId, displayName, icon, rssUrl);
      return { content: [{ type: 'text', text: JSON.stringify(feed, null, 2) }] };
    },
  );

  // ── remove_feed ───────────────────────────────────────────────────────────
  server.tool(
    'remove_feed',
    'Remove a custom feed by its feedId.',
    {
      feedId: z.string().min(1).describe('The feedId of the custom feed to remove.'),
    },
    async ({ feedId }) => {
      await api.removeFeed(feedId);
      return { content: [{ type: 'text', text: `Feed "${feedId}" removed.` }] };
    },
  );
}
