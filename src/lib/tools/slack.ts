const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function sendNotification(channel: string, message: string) {
  if (!WEBHOOK_URL) {
    console.log(`[Slack stub] #${channel}: ${message}`);
    return { ok: true, stub: true };
  }

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text: message }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
  }

  return { ok: true };
}
