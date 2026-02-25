import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, RSSItem } from '../api-client.js';

function isoDate(d?: string): string {
  try { return (d ? new Date(d) : new Date()).toISOString().split('T')[0]; }
  catch { return new Date().toISOString().split('T')[0]; }
}

function buildObsidianUri(filename: string, markdown: string, vault?: string, folder?: string): string {
  const name = folder ? `${folder.replace(/\/$/, '')}/${filename}` : filename;
  const params = new URLSearchParams({ name, content: markdown });
  if (vault) params.set('vault', vault);
  return `obsidian://new?${params.toString()}`;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble the final Obsidian note markdown from components
// ─────────────────────────────────────────────────────────────────────────────
function buildNote(opts: {
  title: string;
  url: string;
  source: string;
  date: string;
  summary?: string;
  tags?: string[];
  keyPoints?: string[];
  wikilinks?: string[];
  bodyMarkdown: string;
}): string {
  const { title, url, source, date, summary, tags, keyPoints, wikilinks, bodyMarkdown } = opts;

  const tagLine = tags && tags.length > 0
    ? `[${tags.map(t => t.replace(/^#/, '')).join(', ')}]`
    : '[news, clipped]';

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `source: ${source}`,
    `url: ${url}`,
    `date: ${date}`,
    `tags: ${tagLine}`,
    summary ? `summary: "${summary.replace(/"/g, '\\"').slice(0, 200)}"` : null,
    '---',
  ].filter(Boolean).join('\n');

  const sections: string[] = [frontmatter, '', `# ${title}`];

  if (summary) {
    sections.push('', `> ${summary}`);
  }

  if (keyPoints && keyPoints.length > 0) {
    sections.push('', '## Key Points', ...keyPoints.map(p => `- ${p}`));
  }

  sections.push('', '## Full Content', '', bodyMarkdown.trim());

  if (wikilinks && wikilinks.length > 0) {
    sections.push('', '## Related', ...wikilinks.map(w => {
      const clean = w.replace(/^\[\[|\]\]$/g, '');
      return `- [[${clean}]]`;
    }));
  }

  return sections.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

export function registerObsidianTools(server: McpServer, api: ApiClient): void {

  // ── save_to_obsidian ──────────────────────────────────────────────────────
  server.tool(
    'save_to_obsidian',
    'Clip an article and assemble a rich Obsidian note. Optionally include an AI-generated summary, ' +
    'tags, key points, and wikilink suggestions. Returns the final markdown AND an obsidian:// URI the ' +
    'user can click to open directly in their vault.',
    {
      url: z.string().url().describe('The article URL to save.'),
      summary: z.string().optional().describe(
        'A 1-3 sentence summary of the article (provide this after reading clip_article output).',
      ),
      tags: z.array(z.string()).optional().describe(
        'Obsidian tags to add, e.g. ["biotech", "FDA", "clinical-trials"].',
      ),
      keyPoints: z.array(z.string()).optional().describe(
        'Bullet-point key takeaways from the article.',
      ),
      wikilinks: z.array(z.string()).optional().describe(
        'Suggested [[WikiLink]] targets to related notes, e.g. ["CRISPR", "Phase III Trials"].',
      ),
      vault: z.string().optional().describe('Obsidian vault name (leave blank for default vault).'),
      folder: z.string().optional().describe('Destination folder inside the vault, e.g. "Reading/News".'),
    },
    async ({ url, summary, tags, keyPoints, wikilinks, vault, folder }) => {
      const clip = await api.clipArticle(url);

      // Strip the YAML frontmatter that /article/clip already added so we
      // can rebuild it with richer metadata
      const bodyMarkdown = clip.markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

      let source = url;
      try { source = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep full url */ }

      const note = buildNote({
        title: clip.title,
        url,
        source,
        date: isoDate(),
        summary,
        tags,
        keyPoints,
        wikilinks,
        bodyMarkdown,
      });

      const filename = sanitizeFilename(clip.title);
      const obsidian_uri = buildObsidianUri(filename, note, vault, folder);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ title: clip.title, filename, obsidian_uri, markdown: note }, null, 2),
        }],
      };
    },
  );

  // ── create_digest_note ────────────────────────────────────────────────────
  server.tool(
    'create_digest_note',
    'Generate a structured daily digest Obsidian note from the current top stories. ' +
    'Each story appears as a section with its title, source, publication time, and description. ' +
    'You can then enrich each story with your own summaries before saving.',
    {
      date: z.string().optional().describe('Date for the digest title (ISO format, default: today).'),
      tags: z.array(z.string()).optional().describe('Extra tags to add beyond ["daily-digest", "news"].'),
      vault: z.string().optional().describe('Obsidian vault name.'),
      folder: z.string().optional().describe('Destination folder, e.g. "Daily Notes/News".'),
    },
    async ({ date, tags: extraTags, vault, folder }) => {
      const lock = await api.getNewspaperLock();

      const noteDate = date ?? isoDate();
      const allTags = ['daily-digest', 'news', ...(extraTags ?? [])];

      // Collect articles from the locked layout
      const layout = lock?.layout;
      const sections: RSSItem[] = [
        ...(layout?.lead ? [layout.lead] : []),
        ...(layout?.related ?? []),
        ...(layout?.featured ? [layout.featured] : []),
        ...(layout?.picks ?? []),
        ...(layout?.topStories ?? []),
      ];

      // Deduplicate
      const seen = new Set<string>();
      const stories = sections.filter(a => {
        if (!a.link || seen.has(a.link)) return false;
        seen.add(a.link);
        return true;
      });

      const lines: string[] = [
        '---',
        `title: "Daily Digest – ${noteDate}"`,
        `date: ${noteDate}`,
        `tags: [${allTags.join(', ')}]`,
        '---',
        '',
        `# Daily Digest – ${noteDate}`,
        '',
        `> ${stories.length} stories from the news dashboard`,
        '',
        '## Top Stories',
      ];

      for (const story of stories) {
        const source = story.sourceName ?? story.source ?? '';
        const rel = story.pubDate
          ? (() => {
              const mins = Math.round((Date.now() - Date.parse(story.pubDate)) / 60_000);
              if (mins < 2) return 'just now';
              if (mins < 60) return `${mins} minutes ago`;
              const hrs = Math.round(mins / 60);
              return hrs === 1 ? 'an hour ago' : `${hrs} hours ago`;
            })()
          : '';

        const desc = (story.description ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 200);

        lines.push(
          '',
          `### [${story.title}](${story.link})`,
          `*${source}*${rel ? ` · ${rel}` : ''}`,
          ...(desc ? ['', desc] : []),
        );
      }

      if (stories.length === 0) {
        lines.push('', '_No stories available. The newspaper layout may not be locked yet._');
      }

      const markdown = lines.join('\n');
      const filename = `Daily Digest – ${noteDate}`;
      const obsidian_uri = buildObsidianUri(filename, markdown, vault, folder);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ date: noteDate, storyCount: stories.length, obsidian_uri, markdown }, null, 2),
        }],
      };
    },
  );
}
