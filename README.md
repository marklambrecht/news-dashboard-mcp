# news-dashboard MCP Server

MCP server for the [news-dashboard](https://github.com/marklambrecht/news-dashboard) app.
Lets AI agents (Claude Desktop, Claude Code) read feeds, clip articles, create Obsidian
notes with summaries, post to BlueSky, and manage feeds/settings.

## Requirements

- Node.js 20+
- The `news-dashboard-nest` backend running and reachable

## Setup

```bash
npm install
npm run build
```

## Claude Desktop integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "news-dashboard": {
      "command": "node",
      "args": ["C:/Users/<user>/Documents/VS Code/news-dashboard/news-dashboard-mcp/dist/index.js"],
      "env": {
        "NEWS_DASHBOARD_API_URL": "https://your-deployed-backend.com"
      }
    }
  }
}
```

For local development set `NEWS_DASHBOARD_API_URL=http://localhost:3002`.

## Tools

| Tool | Description |
|------|-------------|
| `list_feeds` | List all configured feeds |
| `get_articles` | Get articles from one or all feeds |
| `get_top_stories` | Get the current newspaper layout |
| `find_articles_by_topic` | Search articles by keyword across feeds |
| `clip_article` | Fetch full article as Markdown |
| `summarize_article` | Get an AI summary of an article URL |
| `get_article_ogimage` | Extract og:image from any URL |
| `save_to_obsidian` | Build a rich Obsidian note with summary, tags, wikilinks |
| `create_digest_note` | Create a daily digest Obsidian note from top stories |
| `post_to_bluesky` | Share an article to BlueSky |
| `get_settings` | Read current app settings |
| `update_settings` | Update settings (font size, feed order, etc.) |
| `add_feed` | Add a new RSS or BlueSky profile feed |
| `remove_feed` | Remove a custom feed |

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

**Daily digest:**
> "Create a daily digest note from today's top stories and save it to my Daily Notes folder"

**Topic research:**
> "Find all articles about GLP-1 drugs across my feeds and create an Obsidian research note"

**Find and share:**
> "Find the most recent FDA approval news and post it to BlueSky"
