const JIRA_HOST = process.env.JIRA_HOST!;
const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN!;
const JIRA_PROJECT = process.env.JIRA_DEFAULT_PROJECT || "SCHED";

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");

async function jiraFetch(path: string, options?: RequestInit) {
  const res = await fetch(`https://${JIRA_HOST}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Jira API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function createIssue(params: {
  project?: string;
  type: string;
  summary: string;
  description?: string;
  component?: string;
  priority?: string;
}) {
  const fields: any = {
    project: { key: params.project || JIRA_PROJECT },
    issuetype: { name: params.type },
    summary: params.summary,
  };

  if (params.description) {
    fields.description = markdownToAdf(params.description);
  }

  if (params.component) {
    fields.components = [{ name: params.component }];
  }

  if (params.priority) {
    fields.priority = { name: params.priority };
  }

  const result = await jiraFetch("/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  return {
    key: result.key,
    url: `https://${JIRA_HOST}/browse/${result.key}`,
  };
}

export async function getIssue(issueKey: string) {
  const issue = await jiraFetch(`/issue/${issueKey}`);
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name,
    priority: issue.fields.priority?.name,
    assignee: issue.fields.assignee?.displayName || null,
    reporter: issue.fields.reporter?.displayName || null,
    type: issue.fields.issuetype?.name,
    components: issue.fields.components?.map((c: any) => c.name) || [],
    created: issue.fields.created,
    updated: issue.fields.updated,
    description: extractText(issue.fields.description),
    url: `https://${JIRA_HOST}/browse/${issue.key}`,
  };
}

export async function searchIssues(jql: string, maxResults = 10) {
  const result = await jiraFetch(
    `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=key,summary,status,priority,assignee,issuetype,updated`
  );
  return result.issues.map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name,
    priority: issue.fields.priority?.name,
    assignee: issue.fields.assignee?.displayName || null,
    type: issue.fields.issuetype?.name,
    updated: issue.fields.updated,
    url: `https://${JIRA_HOST}/browse/${issue.key}`,
  }));
}

function markdownToAdf(md: string): any {
  const blocks: any[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: inlineToAdf(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Bullet list — collect consecutive lines starting with - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const items: any[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: inlineToAdf(text) }],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    // Regular paragraph — collect lines until blank line or special line
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "paragraph",
      content: inlineToAdf(paraLines.join("\n")),
    });
  }

  return { type: "doc", version: 1, content: blocks };
}

function inlineToAdf(text: string): any[] {
  const nodes: any[] = [];
  // Regex to match: **bold**, `code`, [text](url)
  const re = /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // **bold**
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "strong" }],
      });
    } else if (match[3]) {
      // `code`
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "code" }],
      });
    } else if (match[5]) {
      // [text](url)
      nodes.push({
        type: "text",
        text: match[6],
        marks: [{ type: "link", attrs: { href: match[7] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

function extractText(adf: any): string {
  if (!adf || !adf.content) return "";
  return adf.content
    .flatMap((block: any) =>
      (block.content || []).map((node: any) => node.text || "")
    )
    .join(" ")
    .slice(0, 500);
}

export async function getProjectComponents(project?: string) {
  const components = await jiraFetch(
    `/project/${project || JIRA_PROJECT}/components`
  );
  return components.map((c: any) => ({
    name: c.name,
    description: c.description,
  }));
}
