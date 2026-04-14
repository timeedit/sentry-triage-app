"use client";

import { useState, useEffect, useCallback } from "react";
import type { Schedule } from "@/lib/types";

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cron: "*/30 * * * *",
    prompt:
      'Check Sentry for significant new issues in the last 30 minutes. "Significant" means: new issue with >10 users, or an existing issue with a sudden spike. Summarize any findings concisely.',
    slackChannel: "#sentry-alerts",
    enabled: true,
  });

  const loadSchedules = useCallback(async () => {
    const res = await fetch("/api/schedules");
    setSchedules(await res.json());
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  async function createSchedule() {
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({
      name: "",
      cron: "*/30 * * * *",
      prompt: form.prompt,
      slackChannel: "#sentry-alerts",
      enabled: true,
    });
    loadSchedules();
  }

  async function toggleSchedule(schedule: Schedule) {
    await fetch("/api/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...schedule, enabled: !schedule.enabled }),
    });
    loadSchedules();
  }

  async function deleteSchedule(id: string) {
    await fetch("/api/schedules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSchedules();
  }

  return (
    <div className="schedules">
      <div className="schedules-header">
        <h2>Scheduled Checks</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Schedule"}
        </button>
      </div>

      {showForm && (
        <div className="schedule-form">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Morning triage"
            />
          </label>
          <label>
            Cron Expression
            <input
              value={form.cron}
              onChange={(e) => setForm({ ...form, cron: e.target.value })}
              placeholder="*/30 * * * *"
            />
            <span className="hint">
              e.g. */30 * * * * (every 30 min), 0 9 * * 1-5 (weekdays 9am)
            </span>
          </label>
          <label>
            Slack Channel
            <input
              value={form.slackChannel}
              onChange={(e) =>
                setForm({ ...form, slackChannel: e.target.value })
              }
              placeholder="#sentry-alerts"
            />
          </label>
          <label>
            Prompt
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={4}
            />
          </label>
          <button className="btn-confirm" onClick={createSchedule}>
            Create Schedule
          </button>
        </div>
      )}

      <div className="schedule-list">
        {schedules.length === 0 && !showForm && (
          <p className="empty">No scheduled checks yet.</p>
        )}
        {schedules.map((s) => (
          <div key={s.id} className={`schedule-card ${s.enabled ? "" : "disabled"}`}>
            <div className="schedule-info">
              <strong>{s.name}</strong>
              <code>{s.cron}</code>
              <span className="schedule-channel">{s.slackChannel}</span>
              {s.lastRun && (
                <span className="schedule-last-run">
                  Last run: {new Date(s.lastRun).toLocaleString()}
                </span>
              )}
            </div>
            <div className="schedule-actions">
              <button onClick={() => toggleSchedule(s)}>
                {s.enabled ? "Pause" : "Resume"}
              </button>
              <button className="btn-danger" onClick={() => deleteSchedule(s.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
