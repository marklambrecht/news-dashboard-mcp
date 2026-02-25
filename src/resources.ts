import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from './api-client.js';

export function registerResources(server: McpServer, api: ApiClient): void {

  // ── newsdash://feeds ──────────────────────────────────────────────────────
  server.resource(
    'feeds',
    'newsdash://feeds',
    { description: 'All configured feeds (built-in and custom).' },
    async () => {
      const feeds = await api.getFeeds();
      return {
        contents: [{
          uri: 'newsdash://feeds',
          mimeType: 'application/json',
          text: JSON.stringify(feeds, null, 2),
        }],
      };
    },
  );

  // ── newsdash://feed/{feedId} ──────────────────────────────────────────────
  server.resource(
    'feed-articles',
    new ResourceTemplate('newsdash://feed/{feedId}', { list: undefined }),
    { description: 'Articles from a specific feed. Replace {feedId} with a feed ID such as "techcrunch" or "nature".' },
    async (uri: URL) => {
      const feedId = uri.pathname.replace(/^\//, '');
      const feeds = await api.getFeeds();
      const feed = feeds.find(f => f.feedId === feedId);
      if (!feed) {
        return {
          contents: [{
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Feed "${feedId}" not found.` }),
          }],
        };
      }
      const articles = await api.getFeedArticles(feed);
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(articles, null, 2),
        }],
      };
    },
  );

  // ── newsdash://top-stories ────────────────────────────────────────────────
  server.resource(
    'top-stories',
    'newsdash://top-stories',
    { description: 'Current newspaper layout: hero, related, featured, picks, top stories, and latest articles.' },
    async () => {
      const lock = await api.getNewspaperLock();
      return {
        contents: [{
          uri: 'newsdash://top-stories',
          mimeType: 'application/json',
          text: JSON.stringify(lock ?? { message: 'No layout locked yet.' }, null, 2),
        }],
      };
    },
  );

  // ── newsdash://settings ───────────────────────────────────────────────────
  server.resource(
    'settings',
    'newsdash://settings',
    { description: 'Current user settings (font size, enabled feeds, update intervals, feed order, etc.).' },
    async () => {
      const settings = await api.getSettings();
      return {
        contents: [{
          uri: 'newsdash://settings',
          mimeType: 'application/json',
          text: JSON.stringify(settings ?? {}, null, 2),
        }],
      };
    },
  );
}
