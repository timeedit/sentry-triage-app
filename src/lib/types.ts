export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  name: string;
  input: Record<string, unknown>;
}

export interface ConfirmEvent {
  type: "confirm";
  id: string;
  tool: string;
  input: Record<string, unknown>;
  preview: string;
}

export interface TextEvent {
  type: "text";
  content: string;
}

export interface DoneEvent {
  type: "done";
  fullResponse: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type StreamEvent =
  | ToolCallEvent
  | ConfirmEvent
  | TextEvent
  | DoneEvent
  | ErrorEvent;

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  prompt: string;
  slackChannel: string;
  enabled: boolean;
  lastRun?: string;
}
