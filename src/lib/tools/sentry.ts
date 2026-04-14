const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN!;
const SENTRY_ORG = process.env.SENTRY_ORG || "timeedit-ab";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || "core";
const BASE = "https://sentry.io/api/0";

async function sentryFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SENTRY_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function searchIssues(query: string, timeRange = "24h") {
  const issues = await sentryFetch(
    `/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`,
    { query, statsPeriod: timeRange, limit: "25" }
  );
  return issues.map((issue: any) => ({
    id: issue.shortId,
    title: issue.title,
    culprit: issue.culprit,
    count: issue.count,
    userCount: issue.userCount,
    firstSeen: issue.firstSeen,
    lastSeen: issue.lastSeen,
    status: issue.status,
    permalink: issue.permalink,
  }));
}

export async function getIssue(issueId: string) {
  const issue = await sentryFetch(
    `/organizations/${SENTRY_ORG}/issues/${issueId}/`
  );
  return {
    id: issue.shortId,
    title: issue.title,
    culprit: issue.culprit,
    count: issue.count,
    userCount: issue.userCount,
    firstSeen: issue.firstSeen,
    lastSeen: issue.lastSeen,
    status: issue.status,
    permalink: issue.permalink,
    metadata: issue.metadata,
    type: issue.type,
  };
}

export async function getIssueEvents(issueId: string, limit = 5) {
  const events = await sentryFetch(
    `/organizations/${SENTRY_ORG}/issues/${issueId}/events/`,
    { limit: String(limit) }
  );
  return events.map((event: any) => ({
    id: event.eventID,
    dateCreated: event.dateCreated,
    tags: Object.fromEntries(
      (event.tags || []).map((t: any) => [t.key, t.value])
    ),
    user: event.user,
    message: event.message || event.title,
  }));
}

export async function getIssueTagValues(issueId: string, tagKey: string) {
  const values = await sentryFetch(
    `/organizations/${SENTRY_ORG}/issues/${issueId}/tags/${tagKey}/values/`
  );
  return values.slice(0, 10).map((v: any) => ({
    value: v.value,
    count: v.count,
    firstSeen: v.firstSeen,
    lastSeen: v.lastSeen,
  }));
}
