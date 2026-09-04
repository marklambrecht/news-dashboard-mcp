import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

export function registerBookmarkTools(server: McpServer, api: ApiClient): void {

  // ── list_bookmarks ─────────────────────────────────────────────────────────
  server.tool(
    'list_bookmarks',
    'List all of the signed-in user\'s saved bookmarks/archive.',
    {},
    async () => {
      const bookmarks = await api.getBookmarks();
      return { content: [{ type: 'text', text: JSON.stringify(bookmarks, null, 2) }] };
    },
  );

  // ── add_bookmark ───────────────────────────────────────────────────────────
  server.tool(
    'add_bookmark',
    'Save an article to the user\'s bookmarks/archive.',
    {
      title: z.string().min(1).describe('Article title.'),
      link: z.string().url().describe('Article URL — required by the backend.'),
      description: z.string().optional().describe('Article description/excerpt.'),
      sourceName: z.string().optional().describe('Display name of the source feed.'),
      pubDate: z.string().optional().describe('Publication date (ISO string).'),
      note: z.string().optional().describe('A personal note to attach to the bookmark.'),
    },
    async ({ title, link, description, sourceName, pubDate, note }) => {
      const result = await api.addBookmark({ title, link, description, sourceName, pubDate, note });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── update_bookmark ────────────────────────────────────────────────────────
  server.tool(
    'update_bookmark',
    'Update fields on an existing bookmark, e.g. its note or folder.',
    {
      bookmarkId: z.string().min(1).describe('The bookmarkId to update.'),
      updates: z.record(z.string(), z.unknown()).describe('Fields to merge into the bookmark, e.g. { "note": "..." }.'),
    },
    async ({ bookmarkId, updates }) => {
      await api.updateBookmark(bookmarkId, updates);
      return { content: [{ type: 'text', text: `Bookmark "${bookmarkId}" updated.` }] };
    },
  );

  // ── remove_bookmark ────────────────────────────────────────────────────────
  server.tool(
    'remove_bookmark',
    'Remove a bookmark by its bookmarkId.',
    {
      bookmarkId: z.string().min(1).describe('The bookmarkId to remove.'),
    },
    async ({ bookmarkId }) => {
      await api.removeBookmark(bookmarkId);
      return { content: [{ type: 'text', text: `Bookmark "${bookmarkId}" removed.` }] };
    },
  );
}
