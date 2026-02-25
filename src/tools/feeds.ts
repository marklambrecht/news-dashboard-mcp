import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, RSSItem } from '../api-client.js';

export function registerFeedTools(server: McpServer, api: ApiClient): void {

  // ── list_feeds ──────────────────────────────────────────────────────────
  server.tool(
    'list_feeds',
    'List all configured feeds (built-in and custom) with their IDs, display names, types, and categories.',
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
    'Fetch articles from a specific feed or from all feeds. Returns articles sorted newest-first.',
    {
      feedId: z.string().optional().describe(
        'Feed ID to fetch (e.g. "techcrunch", "nature"). Omit to fetch all enabled feeds.',
      ),
      limit: z.number().int().min(1).max(100).optional().describe(
        'Maximum number of articles to return (default: 20).',
      ),
    },
    async ({ feedId, limit = 20 }) => {
      const feeds = await api.getFeeds();

      const targetFeeds = feedId
        ? feeds.filter(f => f.feedId === feedId)
        : feeds;

      if (targetFeeds.length === 0) {
        return { content: [{ type: 'text', text: `No feed found with id "${feedId}".` }], isError: true };
      }

      const results = await Promise.allSettled(
        targetFeeds.map(f => api.getFeedArticles(f)),
      );

      const articles: RSSItem[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') articles.push(...r.value);
      }

      // Deduplicate by link, sort newest-first
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

      const sliced = unique.slice(0, limit);
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
    'Get the current newspaper layout: hero article, related stories, featured, editor\'s picks, top stories grid, and latest articles.',
    {},
    async () => {
      const lock = await api.getNewspaperLock();
      if (!lock) {
        return {
          content: [{ type: 'text', text: 'No newspaper layout is currently locked. The layout refreshes automatically every ~20 minutes.' }],
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
    'Search for articles matching a topic or keyword across all feeds (or a specific set of feeds). Returns matches sorted by relevance then recency.',
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

      const results = await Promise.allSettled(
        targetFeeds.map(f => api.getFeedArticles(f)),
      );

      const articles: RSSItem[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') articles.push(...r.value);
      }

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
}
