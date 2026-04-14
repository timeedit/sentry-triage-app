"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ChatMessage, StreamEvent, ConfirmEvent } from "@/lib/types";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; input: Record<string, unknown> }[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmEvent | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, activeTools, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: DisplayMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);

    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: "user", content: text },
    ];
    setChatHistory(newHistory);
    setInput("");
    setLoading(true);
    setActiveTools([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      await processStream(res, newHistory);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
      setActiveTools([]);
    }
  }

  async function processStream(
    res: Response,
    currentHistory: ChatMessage[]
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    const toolCallsList: { name: string; input: Record<string, unknown> }[] =
      [];

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        switch (event.type) {
          case "text":
            assistantText += event.content;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: assistantText,
                  toolCalls: toolCallsList.length
                    ? [...toolCallsList]
                    : undefined,
                };
              } else {
                updated.push({
                  role: "assistant",
                  content: assistantText,
                  toolCalls: toolCallsList.length
                    ? [...toolCallsList]
                    : undefined,
                });
              }
              return updated;
            });
            break;

          case "tool_call":
            toolCallsList.push({
              name: event.name,
              input: event.input,
            });
            setActiveTools((prev) => [...prev, event.name]);
            // Update message with tool calls even if no text yet
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  toolCalls: [...toolCallsList],
                };
              } else {
                updated.push({
                  role: "assistant",
                  content: "",
                  toolCalls: [...toolCallsList],
                });
              }
              return updated;
            });
            break;

          case "confirm":
            setPendingConfirm(event);
            break;

          case "done":
            setChatHistory([
              ...currentHistory,
              { role: "assistant", content: event.fullResponse },
            ]);
            break;

          case "error":
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Error: ${event.message}` },
            ]);
            break;
        }
      }
    }
  }

  async function handleConfirm(confirmed: boolean) {
    if (!pendingConfirm) return;

    if (confirmed) {
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmToolId: pendingConfirm.id,
            confirmInput: pendingConfirm.input,
          }),
        });
        const data = await res.json();
        if (data.result) {
          const msg = `Created **${data.result.key}**: ${data.result.url}`;
          setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
          setChatHistory((prev) => [
            ...prev,
            { role: "assistant", content: msg },
          ]);
        } else if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Failed: ${data.error}` },
          ]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.message}` },
        ]);
      } finally {
        setLoading(false);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ticket creation cancelled." },
      ]);
    }

    setPendingConfirm(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Sentry Triage Assistant</h2>
            <p>Ask about Sentry issues, create Jira tickets, or analyze error patterns.</p>
            <div className="suggestions">
              <button onClick={() => sendMessage("How are the Sentry issues looking today?")}>
                Today&apos;s Sentry overview
              </button>
              <button onClick={() => sendMessage("Show me new issues from the last hour")}>
                Last hour&apos;s issues
              </button>
              <button onClick={() => sendMessage("What are the highest-impact unresolved issues?")}>
                Highest-impact issues
              </button>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && activeTools.length > 0 && (
          <div className="tool-indicator">
            {activeTools.map((t, i) => (
              <span key={i} className="tool-badge">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {loading && activeTools.length === 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="thinking">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {pendingConfirm && (
        <ConfirmDialog confirm={pendingConfirm} onResolve={handleConfirm} />
      )}

      <div className="input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Sentry issues..."
          disabled={loading}
          rows={1}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
