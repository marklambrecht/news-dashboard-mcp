import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

export function registerArticleTools(server: McpServer, api: ApiClient): void {

  // ── clip_article ──────────────────────────────────────────────────────────
  server.tool(
    'clip_article',
    'Fetch the full content of an article URL and return it as clean Markdown with YAML frontmatter ' +
    '(title, source, url, date, tags). Use this to get the full text before summarising or saving to Obsidian.',
    {
      url: z.string().url().describe('The article URL to clip.'),
    },
    async ({ url }) => {
      const result = await api.clipArticle(url);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ── summarize_article ─────────────────────────────────────────────────────
  server.tool(
    'summarize_article',
    'Get a concise AI-generated summary of an article URL using the backend summarisation service. ' +
    'Returns a single paragraph summary. Note: you can also summarise directly from clip_article output.',
    {
      url: z.string().url().describe('The article URL to summarise.'),
    },
    async ({ url }) => {
      // Clip first to get the text, then summarise
      const clip = await api.clipArticle(url);
      const result = await api.summarizeText(clip.markdown);
      return {
        content: [{
          type: 'text',
          text: result.summary,
        }],
      };
    },
  );

  // ── get_article_ogimage ───────────────────────────────────────────────────
  server.tool(
    'get_article_ogimage',
    'Extract the Open Graph (og:image) thumbnail URL and alt text from any article URL.',
    {
      url: z.string().url().describe('The article URL.'),
    },
    async ({ url }) => {
      const result = await api.getOgImage(url);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ── get_readability ────────────────────────────────────────────────────────
  server.tool(
    'get_readability',
    'Fetch a distraction-free readable version of an article (title, byline, site name, excerpt, cleaned HTML ' +
    'content, and whether it looks paywalled) using the backend\'s server-side Readability + 7-day cache. ' +
    'Lighter weight than clip_article when you just need the reader-view text, not Markdown/frontmatter.',
    {
      url: z.string().url().describe('The article URL.'),
    },
    async ({ url }) => {
      const result = await api.getReadability(url);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── translate_article ─────────────────────────────────────────────────────
  server.tool(
    'translate_article',
    'Translate article text to English via the backend\'s AI translation service.',
    {
      text: z.string().min(1).describe('The text to translate (article body or title).'),
      url: z.string().url().optional().describe('Source article URL, for context/caching.'),
    },
    async ({ text, url }) => {
      const result = await api.translateArticle(text, url);
      return { content: [{ type: 'text', text: result.translation }] };
    },
  );
}
