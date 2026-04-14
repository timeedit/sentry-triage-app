"use client";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; input: Record<string, unknown> }[];
}

export function MessageBubble({ message }: { message: DisplayMessage }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-header">
        {message.role === "user" ? "You" : "Assistant"}
      </div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls">
          {message.toolCalls.map((tc, i) => (
            <div key={i} className="tool-call">
              <span className="tool-name">{tc.name.replace(/_/g, " ")}</span>
              <span className="tool-args">
                {Object.entries(tc.input)
                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                  .join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
      <div
        className="message-content"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
      />
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    )
    .replace(/\n/g, "<br>");
}
