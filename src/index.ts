import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ApiClient } from './api-client.js';
import { registerFeedTools } from './tools/feeds.js';
import { registerArticleTools } from './tools/article.js';
import { registerObsidianTools } from './tools/obsidian.js';
import { registerBlueskyTools } from './tools/bluesky.js';
import { registerSettingsTools } from './tools/settings.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

const server = new McpServer({
  name: 'news-dashboard',
  version: '1.0.0',
});

const api = new ApiClient(process.env.NEWS_DASHBOARD_API_URL);

// Tools
registerFeedTools(server, api);
registerArticleTools(server, api);
registerObsidianTools(server, api);
registerBlueskyTools(server, api);
registerSettingsTools(server, api);

// Resources (read-only, browseable)
registerResources(server, api);

// Prompts (reusable agent templates)
registerPrompts(server);

// Start
const transport = new StdioServerTransport();
server.connect(transport).catch((err: Error) => {
  process.stderr.write(`Failed to start news-dashboard MCP server: ${err.message}\n`);
  process.exit(1);
});
