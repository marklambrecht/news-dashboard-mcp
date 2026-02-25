import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import express, { Request, Response } from 'express';

import { ApiClient } from './api-client.js';
import { registerFeedTools } from './tools/feeds.js';
import { registerArticleTools } from './tools/article.js';
import { registerObsidianTools } from './tools/obsidian.js';
import { registerBlueskyTools } from './tools/bluesky.js';
import { registerSettingsTools } from './tools/settings.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'news-dashboard', version: '1.0.0' });
  const api = new ApiClient(process.env.NEWS_DASHBOARD_API_URL);

  registerFeedTools(server, api);
  registerArticleTools(server, api);
  registerObsidianTools(server, api);
  registerBlueskyTools(server, api);
  registerSettingsTools(server, api);
  registerResources(server, api);
  registerPrompts(server);

  return server;
}

// ── HTTP mode ────────────────────────────────────────────────────────────────
// Activated when HTTP_PORT env var is set.
// Each MCP session gets its own McpServer + StreamableHTTPServerTransport instance.
// POST /mcp  — client sends JSON-RPC messages
// GET  /mcp  — client opens SSE stream for server-initiated messages
// DELETE /mcp — client closes a session
// ─────────────────────────────────────────────────────────────────────────────
async function startHttpServer(port: number): Promise<void> {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'DELETE') {
      // Client is closing the session
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId)!.close();
        transports.delete(sessionId);
      }
      res.status(200).end();
      return;
    }

    if (sessionId && transports.has(sessionId)) {
      // Existing session — route to its transport
      await transports.get(sessionId)!.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST') {
      // New session initialisation
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };

      const mcpServer = buildMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
      return;
    }

    res.status(400).json({ error: 'Invalid request — send a POST to initialise a session.' });
  });

  app.get('/health', (_req: Request, res: Response) => res.json({ ok: true, server: 'news-dashboard-mcp' }));

  app.listen(port, () => {
    process.stderr.write(
      `news-dashboard MCP server (HTTP) listening on http://localhost:${port}/mcp\n` +
      `Backend API: ${process.env.NEWS_DASHBOARD_API_URL ?? 'http://localhost:3001'}\n`,
    );
  });
}

// ── Stdio mode (default — used by Claude Desktop) ───────────────────────────
async function startStdioServer(): Promise<void> {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Entry point ──────────────────────────────────────────────────────────────
const httpPort = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : null;

if (httpPort !== null) {
  startHttpServer(httpPort).catch((err: Error) => {
    process.stderr.write(`Failed to start HTTP server: ${err.message}\n`);
    process.exit(1);
  });
} else {
  startStdioServer().catch((err: Error) => {
    process.stderr.write(`Failed to start stdio server: ${err.message}\n`);
    process.exit(1);
  });
}
