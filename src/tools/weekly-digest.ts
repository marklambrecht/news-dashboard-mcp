import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

const articleInputSchema = z.object({
  title: z.string(),
  link: z.string().optional(),
  description: z.string().optional(),
  sourceName: z.string().optional(),
  category: z.string().optional(),
  pubDate: z.string().optional(),
});

export function registerWeeklyDigestTools(server: McpServer, api: ApiClient): void {

  // ── get_weekly_digest ──────────────────────────────────────────────────────
  server.tool(
    'get_weekly_digest',
    'Get this week\'s cached Saturday weekly digest as HTML, if one has already been generated.',
    {},
    async () => {
      const result = await api.getWeeklyDigest();
      if (!result?.html) {
        return { content: [{ type: 'text', text: 'No weekly digest generated yet for this week. Call generate_weekly_digest with a list of current articles to build one.' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── generate_weekly_digest ─────────────────────────────────────────────────
  server.tool(
    'generate_weekly_digest',
    'Generate (or regenerate) this week\'s Saturday weekly editorial digest from the articles you supply ' +
    '(fetch these first via get_articles).',
    {
      articles: z.array(articleInputSchema).min(1).describe('Candidate articles for the week — fetch via get_articles first.'),
      force: z.boolean().optional().describe('Regenerate even if a fresh digest is already cached (default: false).'),
    },
    async ({ articles, force }) => {
      const result = await api.generateWeeklyDigest(articles, force ?? false);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── get_weekly_digest_history ──────────────────────────────────────────────
  server.tool(
    'get_weekly_digest_history',
    'Get the last ~8 Saturday weekly digest issues (back issues).',
    {},
    async () => {
      const history = await api.getWeeklyDigestHistory();
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    },
  );
}
