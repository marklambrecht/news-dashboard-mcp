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
  note: z.string().optional(),
});

export function registerIntelligenceTools(server: McpServer, api: ApiClient): void {

  // ── generate_digest ────────────────────────────────────────────────────────
  server.tool(
    'generate_digest',
    'Generate a quick AI digest — a short written summary of the most important stories — from a list of ' +
    'articles you supply. This is the lightweight one-shot alternative to the Morning Edition; use it when ' +
    'you just want "what are today\'s top stories" as text, not a full magazine layout.',
    {
      articles: z.array(articleInputSchema).min(1).describe('Articles to digest — fetch via get_articles first.'),
      force: z.boolean().optional().describe('Regenerate even if a fresh digest is already cached (default: false).'),
    },
    async ({ articles, force }) => {
      const result = await api.generateDigest(articles, force ?? false);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── get_intelligence_briefing ──────────────────────────────────────────────
  server.tool(
    'get_intelligence_briefing',
    'Get the cached AI intelligence briefing for one category, plus its query status (idle/running/error) and ' +
    'when it was last run.',
    {
      category: z.string().min(1).describe('Category id, e.g. "tech", "biotech", "science".'),
    },
    async ({ category }) => {
      const result = await api.getIntelligence(category);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── refresh_intelligence_briefing ──────────────────────────────────────────
  server.tool(
    'refresh_intelligence_briefing',
    'Generate a fresh AI intelligence briefing for one category from the articles you supply. Skips ' +
    'regeneration if a result already exists from the last 6 hours, unless force is set. Runs synchronously ' +
    'and can take 20-40 seconds.',
    {
      category: z.string().min(1).describe('Category id, e.g. "tech", "biotech", "science".'),
      articles: z.array(articleInputSchema).optional().describe('Articles in this category — fetch via get_articles first.'),
      force: z.boolean().optional().describe('Regenerate even if cached results are fresh (default: false).'),
    },
    async ({ category, articles, force }) => {
      const result = await api.refreshIntelligence(category, articles, force ?? false);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── ask_news ───────────────────────────────────────────────────────────────
  server.tool(
    'ask_news',
    'Ask a free-form question answered against a specific set of articles, with citations. Supports ' +
    'multi-turn follow-ups via the history parameter.',
    {
      question: z.string().min(1).describe('The question to ask.'),
      articles: z.array(z.object({
        index: z.number(),
        title: z.string(),
        description: z.string(),
        sourceName: z.string(),
        pubDate: z.string(),
        link: z.string(),
      })).describe('Articles to answer from — each needs a stable 0-based index for citations.'),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('Prior turns in this conversation, for follow-up questions.'),
    },
    async ({ question, articles, history }) => {
      const result = await api.askNews(question, articles, history);
      return { content: [{ type: 'text', text: result.answer }] };
    },
  );

  // ── thread_summary ─────────────────────────────────────────────────────────
  server.tool(
    'thread_summary',
    'Summarise how a narrative thread (tracked by keywords) has evolved over time, given the articles ' +
    'matching those keywords.',
    {
      keywords: z.array(z.string()).min(1).describe('Keywords defining the thread.'),
      articles: z.array(z.object({
        title: z.string(),
        sourceName: z.string(),
        pubDate: z.string(),
      })).describe('Articles matching the thread, oldest to newest.'),
    },
    async ({ keywords, articles }) => {
      const result = await api.threadSummary(keywords, articles);
      return { content: [{ type: 'text', text: result.summary }] };
    },
  );

  // ── generate_newsletter ────────────────────────────────────────────────────
  server.tool(
    'generate_newsletter',
    'Generate a structured plain-text newsletter draft from a set of articles (e.g. saved bookmarks).',
    {
      articles: z.array(articleInputSchema).min(1).describe('Articles to include, e.g. from list_bookmarks.'),
    },
    async ({ articles }) => {
      const result = await api.generateNewsletter(articles);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── generate_newsletter_image ──────────────────────────────────────────────
  server.tool(
    'generate_newsletter_image',
    'Generate an AI cover image for a newsletter draft.',
    {
      title: z.string().min(1).describe('Newsletter title.'),
      articleTitles: z.array(z.string()).optional().describe('Titles of the articles it covers, for visual context.'),
    },
    async ({ title, articleTitles }) => {
      const result = await api.generateNewsletterImage(title, articleTitles ?? []);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── generate_linkedin_post ─────────────────────────────────────────────────
  server.tool(
    'generate_linkedin_post',
    'Generate a thought-leader LinkedIn post drawing on a set of articles.',
    {
      articles: z.array(articleInputSchema).min(1).describe('Articles to draw on, e.g. from list_bookmarks.'),
    },
    async ({ articles }) => {
      const result = await api.generateLinkedInPost(articles);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
