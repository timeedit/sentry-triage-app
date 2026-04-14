# Sentry Triage

AI-powered Sentry issue triage with Jira ticket creation and scheduled Slack alerts.

A Next.js app that uses Claude as an agentic backend to analyze Sentry issues, create and read Jira tickets, and run scheduled monitoring with Slack notifications.

## Features

**Interactive chat** -- Ask questions about Sentry issues in natural language. Claude searches and analyzes issues, identifies patterns across tenants, and summarizes impact.

**Jira integration** -- Create tickets directly from the chat with a confirmation dialog before submission. Read existing tickets and search with JQL. Descriptions are formatted with proper headings, bold, code, links, and bullet lists.

**Scheduled monitoring** -- Set up cron-based checks that run a prompt against Sentry on a schedule and post findings to Slack. Configure per-schedule prompts, cron expressions, and target channels.

**Tool visibility** -- The UI shows which tools Claude is calling as it works (e.g. "search sentry issues", "get sentry tag values").

## Setup

```bash
cp .env.example .env.local
# Fill in your API keys (see below)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Source |
|----------|--------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) > API Keys |
| `SENTRY_AUTH_TOKEN` | Sentry > Settings > Developer Settings > Internal Integration (read scope on Project, Issue, Event) |
| `SENTRY_ORG` | Sentry organization slug (default: `timeedit-ab`) |
| `SENTRY_PROJECT` | Sentry project slug (default: `core`) |
| `JIRA_HOST` | e.g. `yourorg.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian account email |
| `JIRA_API_TOKEN` | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_DEFAULT_PROJECT` | Default Jira project key (default: `SCHED`) |
| `SLACK_WEBHOOK_URL` | [api.slack.com/apps](https://api.slack.com/apps) > Incoming Webhooks |

## Available tools

Claude has access to the following tools and decides when to use them based on your questions:

| Tool | Description |
|------|-------------|
| `search_sentry_issues` | Search with Sentry query syntax |
| `get_sentry_issue` | Get details for a specific issue |
| `get_sentry_issue_events` | Get recent events for an issue |
| `get_sentry_tag_values` | Tag distribution (url, browser, method, etc.) |
| `create_jira_ticket` | Create a ticket (requires confirmation) |
| `get_jira_issue` | Read a ticket by key |
| `search_jira_issues` | Search tickets with JQL |
| `get_jira_components` | List project components |
| `send_slack_notification` | Post to a Slack channel |

## Architecture

```
Browser (React)
  |
  | SSE stream
  v
Next.js API routes
  |
  | Agentic tool-use loop
  v
Claude API (claude-sonnet-4-6)
  |
  |--- Sentry REST API
  |--- Jira REST API
  |--- Slack Webhooks
```

The chat endpoint (`/api/chat`) streams responses via Server-Sent Events. Claude calls tools as needed, the server executes them and feeds results back, repeating until Claude produces a final text response.

For Jira ticket creation, the stream pauses and sends a `confirm` event to the frontend, which shows a dialog. The ticket is only created after the user confirms.

Scheduled checks run via `node-cron`, initialized on server boot through Next.js [instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation). Schedules are stored as JSON in a `data/` directory.

## Project structure

```
src/
  app/
    api/chat/route.ts         -- Streaming chat endpoint
    api/schedules/route.ts    -- Schedule CRUD
    page.tsx                  -- Chat + Schedules tabs
  components/
    ChatInterface.tsx         -- Chat with streaming and tool indicators
    ConfirmDialog.tsx         -- Jira ticket confirmation modal
    MessageBubble.tsx         -- Message rendering
    ScheduleManager.tsx       -- Schedule management UI
  lib/
    claude.ts                 -- Claude API integration and agentic loop
    scheduler.ts              -- Cron-based scheduled checks
    tools/
      sentry.ts               -- Sentry REST API client
      jira.ts                 -- Jira REST API client + markdown-to-ADF
      slack.ts                -- Slack webhook client
    types.ts                  -- Shared TypeScript types
  instrumentation.ts          -- Starts scheduler on server boot
```
