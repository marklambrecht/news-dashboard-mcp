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

export function registerMorningEditionTools(server: McpServer, api: ApiClient): void {

  // ── get_morning_edition ────────────────────────────────────────────────────
  server.tool(
    'get_morning_edition',
    'Get today\'s cached Morning Edition (the AI-curated daily magazine) as HTML, if one has already been generated.',
    {},
    async () => {
      const result = await api.getMorningEdition();
      if (!result?.html) {
        return { content: [{ type: 'text', text: 'No Morning Edition generated yet for today. Call generate_morning_edition with a list of current articles to build one.' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── generate_morning_edition ───────────────────────────────────────────────
  server.tool(
    'generate_morning_edition',
    'Generate (or regenerate) today\'s Morning Edition: an AI curates the most important stories from the ' +
    'articles you supply (fetch these first via get_articles), then the backend renders the full magazine HTML. ' +
    'This runs the two-step pipeline (curate, then build) and can take 30-60 seconds.',
    {
      articles: z.array(articleInputSchema).min(1).describe('Candidate articles to curate from — fetch via get_articles first.'),
      force: z.boolean().optional().describe('Regenerate even if a fresh edition is already cached (default: false).'),
    },
    async ({ articles, force }) => {
      const curated = await api.curateMorningEdition(articles, force ?? false);
      const built = await api.buildMorningEdition();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ storyCount: curated.storyCount, ...built }, null, 2),
        }],
      };
    },
  );

  // ── get_morning_edition_history ────────────────────────────────────────────
  server.tool(
    'get_morning_edition_history',
    'Get the last 30 days of Morning Edition issues (back issues / digest history).',
    {},
    async () => {
      const history = await api.getMorningEditionHistory();
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    },
  );

  // ── send_morning_edition_email ─────────────────────────────────────────────
  server.tool(
    'send_morning_edition_email',
    'Email today\'s cached Morning Edition to the user\'s configured account email. Must be generated first.',
    {},
    async () => {
      const result = await api.sendMorningEditionEmail();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
