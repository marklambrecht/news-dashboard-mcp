import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

export function registerBlueskyTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'post_to_bluesky',
    'Share an article to BlueSky. Provide the post text (max 300 chars), your BlueSky credentials, ' +
    'and optionally the article URL/title/description to attach as a link card.',
    {
      text: z.string().max(300).describe('The post text (max 300 characters).'),
      identifier: z.string().describe('Your BlueSky handle or email (e.g. user.bsky.social).'),
      password: z.string().describe('Your BlueSky app password (NOT your account password — create one at bsky.app/settings).'),
      articleUrl: z.string().url().optional().describe('URL to attach as a link card.'),
      articleTitle: z.string().optional().describe('Title for the link card.'),
      articleDescription: z.string().optional().describe('Description for the link card.'),
      imageUrl: z.string().url().optional().describe('Thumbnail image URL for the link card.'),
    },
    async ({ text, identifier, password, articleUrl, articleTitle, articleDescription, imageUrl }) => {
      const result = await api.postToBluesky({
        text,
        identifier,
        password,
        articleUrl,
        articleTitle,
        articleDescription,
        imageUrl,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );
}
