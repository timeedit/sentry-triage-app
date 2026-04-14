import { NextRequest } from "next/server";
import { chat } from "@/lib/claude";
import type { ChatMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { messages, confirmToolId, confirmInput } = (await req.json()) as {
    messages: ChatMessage[];
    confirmToolId?: string;
    confirmInput?: Record<string, any>;
  };

  // If this is a confirmation follow-up, execute the Jira creation
  // and return the result as a simple JSON response
  if (confirmToolId && confirmInput) {
    try {
      const { createIssue } = await import("@/lib/tools/jira");
      const result = await createIssue(confirmInput as Parameters<typeof createIssue>[0]);
      return Response.json({ result });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of chat(messages)) {
          const data = JSON.stringify(event) + "\n";
          controller.enqueue(encoder.encode(`data: ${data}\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err: any) {
        const errorEvent = JSON.stringify({
          type: "error",
          message: err.message,
        });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
