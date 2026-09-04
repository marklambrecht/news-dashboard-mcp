# news-dashboard MCP Server

MCP server for the [news-dashboard](https://github.com/marklambrecht/news-dashboard) app.
Lets AI agents (Claude Desktop, Claude Code) read feeds, manage bookmarks, generate the
daily Morning Edition and AI intelligence briefings, clip/translate articles, create
Obsidian notes, and post to BlueSky.

## Requirements

- Node.js 20+
- The `news-dashboard-nest` backend running and reachable
- A valid JWT access token for a registered user (see **Authentication** below) — the
  backend requires a signed-in user for almost every route.

## Setup

```bash
npm install
npm run build
```

## Authentication

The backend (`news-dashboard-nest`) guards nearly every route with a JWT, the same way
the web app does. This MCP server does not implement its own login flow — instead, you
supply a pre-issued access token:

1. Log into the news dashboard (web app) normally, or call the backend directly:
   ```bash
   curl -X POST https://your-backend-url/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"you@example.com","password":"...","rememberMe":true}'
   ```
   This returns `{ "accessToken": "..." }`. With `rememberMe: true` the token is valid
   for 30 days; otherwise 2 hours.
2. Set `NEWS_DASHBOARD_TOKEN` to that value in the MCP server's environment (see below).

When the token expires or is rejected, tools return a clear error telling you to repeat
this step and update the config — there is no automatic refresh.

## Claude Desktop integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "news-dashboard": {
      "command": "node",
      "args": ["/path/to/news-dashboard-mcp/dist/index.js"],
      "env": {
        "NEWS_DASHBOARD_API_URL": "https://your-deployed-backend.com",
        "NEWS_DASHBOARD_TOKEN": "eyJhbGciOi..."
      }
    }
  }
}
```

For local development set `NEWS_DASHBOARD_API_URL=http://localhost:3001`.

## Tools

### Feeds & articles
| Tool | Description |
|------|-------------|
| `list_feeds` | List all configured feeds (RSS/Atom + BlueSky profile) |
| `get_articles` | Get articles from one feed or all feeds |
| `get_top_stories` | Get the current locked newspaper front-page layout |
| `find_articles_by_topic` | Client-side keyword search across feeds (no server-side index) |
| `add_feed` | Add a new RSS or BlueSky profile feed |
| `rename_feed` | Rename a feed / change its icon or URL |
| `remove_feed` | Remove a custom feed |

### Bookmarks
| Tool | Description |
|------|-------------|
| `list_bookmarks` | List saved bookmarks/archive |
| `add_bookmark` | Save an article |
| `update_bookmark` | Update a bookmark's note/fields |
| `remove_bookmark` | Remove a bookmark |

### Article tools
| Tool | Description |
|------|-------------|
| `clip_article` | Fetch full article as Markdown with frontmatter |
| `summarize_article` | AI summary of an article URL |
| `get_article_ogimage` | Extract og:image from any URL |
| `get_readability` | Server-cached distraction-free reader view of an article |
| `translate_article` | Translate article text to English |

### Digests & briefings
| Tool | Description |
|------|-------------|
| `generate_digest` | Quick one-shot AI digest of supplied articles |
| `get_morning_edition` / `generate_morning_edition` | Read / build today's AI-curated magazine |
| `get_morning_edition_history` | Last 30 days of Morning Edition issues |
| `send_morning_edition_email` | Email today's edition |
| `get_weekly_digest` / `generate_weekly_digest` | Read / build this week's Saturday digest |
| `get_weekly_digest_history` | Last ~8 weekly digest issues |
| `get_intelligence_briefing` / `refresh_intelligence_briefing` | Read / regenerate a per-category AI briefing |
| `ask_news` | Multi-turn Q&A with citations over a supplied article set |
| `thread_summary` | Summarise how a keyword-tracked thread evolved over time |
| `generate_newsletter` / `generate_newsletter_image` | Draft a newsletter (+ AI cover image) from articles |
| `generate_linkedin_post` | Draft a LinkedIn post from articles |

### Obsidian
| Tool | Description |
|------|-------------|
| `save_to_obsidian` | Build a rich Obsidian note with summary, tags, wikilinks |
| `create_digest_note` | Create a daily digest Obsidian note from top stories |

### BlueSky & settings
| Tool | Description |
|------|-------------|
| `post_to_bluesky` | Share an article to BlueSky |
| `get_settings` / `update_settings` | Read/update app settings |

**Not covered by this server** (client-side-only in the web app, no backend endpoint to
wrap): search/story-clustering/trends/alerts over already-loaded articles. Also out of
scope: admin endpoints, the audio brief (binary MP3 streaming), and the paywall-capture
bookmarklet flow.

## Resources

| URI | Description |
|-----|-------------|
| `newsdash://feeds` | All configured feeds |
| `newsdash://feed/{feedId}` | Articles from a specific feed |
| `newsdash://top-stories` | Current newspaper layout |
| `newsdash://settings` | Current user settings |

## Prompts

| Name | Description |
|------|-------------|
| `daily-briefing` | Generate a structured daily news briefing |
| `obsidian-research-note` | Research a topic and save to Obsidian |
| `bluesky-post-draft` | Draft a BlueSky post for an article |

## Example agent workflows

**Save an article to Obsidian with a summary:**
> "Clip https://... and save it to my Obsidian Research/Biotech folder with a summary and relevant tags"

**Today's top 5 stories:**
> "Fetch today's articles and generate a digest of the 5 most important stories"

**Morning Edition:**
> "Pull today's articles and generate my Morning Edition"

**Topic research:**
> "Find all articles about GLP-1 drugs across my feeds and create an Obsidian research note"

**Find and share:**
> "Find the most recent FDA approval news and post it to BlueSky"
