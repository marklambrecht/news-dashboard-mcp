import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

export function registerSettingsTools(server: McpServer, api: ApiClient): void {

  // ── get_settings ──────────────────────────────────────────────────────────
  server.tool(
    'get_settings',
    'Get the current app settings stored in Redis. Includes fontSize, maxArticles, ' +
    'enabledComponents (per-feed on/off), updateIntervals, feedCategories, and feed order.',
    {},
    async () => {
      const settings = await api.getSettings();
      return {
        content: [{
          type: 'text',
          text: settings ? JSON.stringify(settings, null, 2) : 'No settings stored yet.',
        }],
      };
    },
  );

  // ── update_settings ───────────────────────────────────────────────────────
  server.tool(
    'update_settings',
    'Update app settings. Pass only the keys you want to change — they are merged with existing settings. ' +
    'Example: { "appSettings": { "fontSize": "large" } } or { "feedOrder": ["techcrunch", "nature"] }',
    {
      appSettings: z.record(z.string(), z.unknown()).optional().describe(
        'App settings to merge, e.g. { "fontSize": "large", "maxArticles": 20 }.',
      ),
      feedOrder: z.array(z.string()).optional().describe(
        'New feed display order as array of feedIds.',
      ),
    },
    async ({ appSettings, feedOrder }) => {
      const patch: Record<string, unknown> = {};
      if (appSettings) patch.appSettings = appSettings;
      if (feedOrder) patch.feedOrder = feedOrder;
      if (Object.keys(patch).length === 0) {
        return { content: [{ type: 'text', text: 'Nothing to update — provide appSettings or feedOrder.' }] };
      }
      await api.patchSettings(patch);
      return { content: [{ type: 'text', text: 'Settings updated successfully.' }] };
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
        'Category IDs to assign, e.g. ["biotech", "science"].',
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

  // ── remove_feed ───────────────────────────────────────────────────────────
  server.tool(
    'remove_feed',
    'Remove a custom feed by its feedId. Built-in feeds cannot be removed.',
    {
      feedId: z.string().min(1).describe('The feedId of the custom feed to remove.'),
    },
    async ({ feedId }) => {
      await api.removeFeed(feedId);
      return { content: [{ type: 'text', text: `Feed "${feedId}" removed.` }] };
    },
  );
}
