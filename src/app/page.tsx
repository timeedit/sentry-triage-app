"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { ScheduleManager } from "@/components/ScheduleManager";

export default function Home() {
  const [tab, setTab] = useState<"chat" | "schedules">("chat");

  return (
    <main>
      <header>
        <h1>Sentry Triage</h1>
        <nav>
          <button
            className={tab === "chat" ? "active" : ""}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            className={tab === "schedules" ? "active" : ""}
            onClick={() => setTab("schedules")}
          >
            Schedules
          </button>
        </nav>
      </header>
      {tab === "chat" ? <ChatInterface /> : <ScheduleManager />}
    </main>
  );
}
