import fs from "fs";
import path from "path";
import cron from "node-cron";
import type { Schedule } from "./types";
import { runPrompt } from "./claude";
import { sendNotification } from "./tools/slack";

const DATA_DIR = path.join(process.cwd(), "data");
const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");

const activeTasks = new Map<string, cron.ScheduledTask>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSchedules(): Schedule[] {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8"));
}

export function saveSchedules(schedules: Schedule[]) {
  ensureDataDir();
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
}

async function executeSchedule(schedule: Schedule) {
  console.log(`[Scheduler] Running "${schedule.name}"`);
  try {
    const result = await runPrompt(schedule.prompt);

    // Update last run time
    const schedules = loadSchedules();
    const idx = schedules.findIndex((s) => s.id === schedule.id);
    if (idx !== -1) {
      schedules[idx].lastRun = new Date().toISOString();
      saveSchedules(schedules);
    }

    // If the result contains actionable content, notify Slack
    if (result.trim().length > 0) {
      await sendNotification(
        schedule.slackChannel,
        `*Scheduled Sentry check: ${schedule.name}*\n\n${result}`
      );
    }

    console.log(`[Scheduler] Completed "${schedule.name}"`);
  } catch (err) {
    console.error(`[Scheduler] Error in "${schedule.name}":`, err);
  }
}

export function startSchedule(schedule: Schedule) {
  stopSchedule(schedule.id);

  if (!schedule.enabled) return;
  if (!cron.validate(schedule.cron)) {
    console.error(`[Scheduler] Invalid cron for "${schedule.name}": ${schedule.cron}`);
    return;
  }

  const task = cron.schedule(schedule.cron, () => executeSchedule(schedule));
  activeTasks.set(schedule.id, task);
  console.log(`[Scheduler] Started "${schedule.name}" (${schedule.cron})`);
}

export function stopSchedule(id: string) {
  const task = activeTasks.get(id);
  if (task) {
    task.stop();
    activeTasks.delete(id);
  }
}

export function initScheduler() {
  const schedules = loadSchedules();
  for (const schedule of schedules) {
    startSchedule(schedule);
  }
  console.log(`[Scheduler] Initialized ${schedules.length} schedule(s)`);
}
