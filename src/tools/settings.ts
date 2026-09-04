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
}
