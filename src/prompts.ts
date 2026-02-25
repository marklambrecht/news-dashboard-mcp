import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {

  // ── daily-briefing ────────────────────────────────────────────────────────
  server.prompt(
    'daily-briefing',
    'Generate a structured daily news briefing from top stories.',
    {
      date: z.string().optional().describe('Date for the briefing (e.g. "25 Feb 2026"). Defaults to today.'),
      topic: z.string().optional().describe('Optional topic focus, e.g. "biotech and pharma".'),
    },
    ({ date, topic }) => {
      const dateStr = date ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const topicClause = topic ? ` focusing on ${topic}` : '';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Using the top stories from the news dashboard for ${dateStr}${topicClause}, write a structured daily briefing.\n\n` +
              `Format:\n` +
              `1. **Headline** — one sentence summary\n` +
              `   Source · time ago\n` +
              `   Key implication or context sentence.\n\n` +
              `Start by calling get_top_stories to retrieve today's articles, then write the briefing. ` +
              `Highlight any cross-cutting themes at the end.`,
          },
        }],
      };
    },
  );

  // ── obsidian-research-note ────────────────────────────────────────────────
  server.prompt(
    'obsidian-research-note',
    'Research a topic across all feeds and create a comprehensive Obsidian research note.',
    {
      topic: z.string().describe('Topic to research, e.g. "GLP-1 drugs" or "AI in drug discovery".'),
      vault: z.string().optional().describe('Obsidian vault name to save into.'),
      folder: z.string().optional().describe('Vault folder, e.g. "Research/Biotech".'),
    },
    ({ topic, vault, folder }) => {
      const vaultClause = vault ? ` into the "${vault}" vault` : '';
      const folderClause = folder ? ` in the "${folder}" folder` : '';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Research the topic "${topic}" using the news dashboard feeds and create a comprehensive Obsidian research note${vaultClause}${folderClause}.\n\n` +
              `Steps:\n` +
              `1. Call find_articles_by_topic with query="${topic}" to find relevant articles.\n` +
              `2. For the 3 most relevant articles, call clip_article to get full content.\n` +
              `3. Synthesise a research note with:\n` +
              `   - A 3-5 sentence overview of the topic\n` +
              `   - Key findings and data points as bullets\n` +
              `   - Notable companies, drugs, or people mentioned\n` +
              `   - Open questions or controversies\n` +
              `   - Suggested [[wikilinks]] to related topics\n` +
              `4. Call save_to_obsidian with the assembled content, appropriate tags, and wikilinks.\n` +
              `5. Return the obsidian_uri so the user can open the note.`,
          },
        }],
      };
    },
  );

  // ── bluesky-post-draft ────────────────────────────────────────────────────
  server.prompt(
    'bluesky-post-draft',
    'Draft a compelling BlueSky post for sharing a news article.',
    {
      articleTitle: z.string().describe('The article headline.'),
      articleUrl: z.string().describe('The article URL.'),
      context: z.string().optional().describe('Optional extra context or angle to emphasise.'),
    },
    ({ articleTitle, articleUrl, context }) => {
      const contextClause = context ? `\n\nAngle to emphasise: ${context}` : '';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Write a compelling BlueSky post sharing this article:\n\n` +
              `Title: "${articleTitle}"\n` +
              `URL: ${articleUrl}${contextClause}\n\n` +
              `Requirements:\n` +
              `- Maximum 280 characters (BlueSky limit)\n` +
              `- Informative and engaging, not clickbait\n` +
              `- Include the URL at the end\n` +
              `- Use plain language, no excessive hashtags\n\n` +
              `Draft 2-3 options and indicate character counts. ` +
              `Then call post_to_bluesky with the best option if credentials are available.`,
          },
        }],
      };
    },
  );
}
