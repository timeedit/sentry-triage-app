import Anthropic from "@anthropic-ai/sdk";
import * as sentry from "./tools/sentry";
import * as jira from "./tools/jira";
import * as slack from "./tools/slack";
import type { ChatMessage, StreamEvent } from "./types";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a Sentry triage assistant for TimeEdit.
You help analyze Sentry issues from the "core" project (timeedit-ab org) and create Jira tickets in the SCHED project.

When analyzing issues:
- Identify patterns, affected tenants, and severity
- Be concise — terse analysis is preferred
- Group related issues when relevant

When creating Jira tickets:
- Default to Bug type unless told otherwise
- Include Sentry issue IDs, user/event counts, and a brief root cause analysis
- Ask the user to confirm before creating

When running scheduled checks:
- Focus on genuinely new or spiking issues
- Only notify about significant changes`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_sentry_issues",
    description:
      "Search for Sentry issues. Use query syntax like 'is:unresolved' or free text.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Sentry search query, e.g. 'is:unresolved age:-24h'",
        },
        time_range: {
          type: "string",
          description: "Stats period, e.g. '24h', '7d', '14d'. Default '24h'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_sentry_issue",
    description: "Get details for a specific Sentry issue by its short ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: {
          type: "string",
          description: "Sentry short ID, e.g. 'CORE-55M'",
        },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "get_sentry_issue_events",
    description: "Get recent events for a Sentry issue.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: { type: "string" },
        limit: { type: "number", description: "Max events to return (default 5)" },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "get_sentry_tag_values",
    description:
      "Get distribution of a tag across events in an issue. Common tags: url, browser, os, method, environment.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: { type: "string" },
        tag_key: { type: "string", description: "e.g. 'url', 'browser', 'method'" },
      },
      required: ["issue_id", "tag_key"],
    },
  },
  {
    name: "create_jira_ticket",
    description:
      "Create a Jira ticket. Returns the ticket key and URL. Always confirm with the user first.",
    input_schema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project key. Default: SCHED" },
        type: { type: "string", description: "Issue type: Bug, Task, Story, etc." },
        summary: { type: "string", description: "Ticket title" },
        description: { type: "string", description: "Ticket body" },
        component: { type: "string", description: "Component name, e.g. 'am-fe'" },
        priority: {
          type: "string",
          description: "Priority: Critical, High, Medium, Low, Lowest",
        },
      },
      required: ["type", "summary"],
    },
  },
  {
    name: "get_jira_issue",
    description: "Get details of a Jira ticket by its key (e.g. SCHED-2786).",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "Jira issue key, e.g. 'SCHED-2786'",
        },
      },
      required: ["issue_key"],
    },
  },
  {
    name: "search_jira_issues",
    description:
      "Search Jira issues using JQL. Returns matching tickets with status, priority, and assignee.",
    input_schema: {
      type: "object" as const,
      properties: {
        jql: {
          type: "string",
          description:
            "JQL query, e.g. 'project = SCHED AND status != Done ORDER BY updated DESC'",
        },
        max_results: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: ["jql"],
    },
  },
  {
    name: "get_jira_components",
    description: "List available components for a Jira project.",
    input_schema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project key. Default: SCHED" },
      },
      required: [],
    },
  },
  {
    name: "send_slack_notification",
    description: "Post a message to a Slack channel.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Slack channel name" },
        message: { type: "string", description: "Message text (supports Slack markdown)" },
      },
      required: ["channel", "message"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<string> {
  switch (name) {
    case "search_sentry_issues":
      return JSON.stringify(
        await sentry.searchIssues(input.query, input.time_range)
      );
    case "get_sentry_issue":
      return JSON.stringify(await sentry.getIssue(input.issue_id));
    case "get_sentry_issue_events":
      return JSON.stringify(
        await sentry.getIssueEvents(input.issue_id, input.limit)
      );
    case "get_sentry_tag_values":
      return JSON.stringify(
        await sentry.getIssueTagValues(input.issue_id, input.tag_key)
      );
    case "create_jira_ticket":
      return JSON.stringify(await jira.createIssue(input as Parameters<typeof jira.createIssue>[0]));
    case "get_jira_issue":
      return JSON.stringify(await jira.getIssue(input.issue_key));
    case "search_jira_issues":
      return JSON.stringify(
        await jira.searchIssues(input.jql, input.max_results)
      );
    case "get_jira_components":
      return JSON.stringify(await jira.getProjectComponents(input.project));
    case "send_slack_notification":
      return JSON.stringify(
        await slack.sendNotification(input.channel, input.message)
      );
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function* chat(
  messages: ChatMessage[],
  options?: { autoConfirmJira?: boolean }
): AsyncGenerator<StreamEvent> {
  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let continueLoop = true;

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: apiMessages,
    });

    let textContent = "";
    const toolCalls: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
        yield { type: "text", content: block.text };
      } else if (block.type === "tool_use") {
        toolCalls.push(block);
      }
    }

    if (toolCalls.length === 0) {
      continueLoop = false;
      yield { type: "done", fullResponse: textContent };
      break;
    }

    // Process tool calls
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const call of toolCalls) {
      const input = call.input as Record<string, any>;

      // For Jira creation in interactive mode, require confirmation
      if (call.name === "create_jira_ticket" && !options?.autoConfirmJira) {
        yield {
          type: "confirm",
          id: call.id,
          tool: call.name,
          input,
          preview: `Create ${input.type} in ${input.project || "SCHED"}: "${input.summary}"`,
        };
        // In the streaming model, we return here and the caller
        // must resume with a new chat() call including the confirmation result
        return;
      }

      yield { type: "tool_call", name: call.name, input };

      try {
        const result = await executeTool(call.name, input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: result,
        });
      } catch (err: any) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `Error: ${err.message}`,
          is_error: true,
        });
      }
    }

    apiMessages.push({ role: "user", content: toolResults });
  }
}

/** Non-streaming version for scheduled runs */
export async function runPrompt(prompt: string): Promise<string> {
  const collected: string[] = [];
  for await (const event of chat([{ role: "user", content: prompt }], {
    autoConfirmJira: false,
  })) {
    if (event.type === "text") collected.push(event.content);
    if (event.type === "done") break;
  }
  return collected.join("");
}
