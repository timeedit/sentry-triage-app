import { NextRequest } from "next/server";
import {
  loadSchedules,
  saveSchedules,
  startSchedule,
  stopSchedule,
} from "@/lib/scheduler";
import type { Schedule } from "@/lib/types";

export async function GET() {
  return Response.json(loadSchedules());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Omit<Schedule, "id">;
  const schedules = loadSchedules();

  const schedule: Schedule = {
    ...body,
    id: crypto.randomUUID(),
  };

  schedules.push(schedule);
  saveSchedules(schedules);
  startSchedule(schedule);

  return Response.json(schedule, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Schedule;
  const schedules = loadSchedules();
  const idx = schedules.findIndex((s) => s.id === body.id);

  if (idx === -1) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  schedules[idx] = body;
  saveSchedules(schedules);

  stopSchedule(body.id);
  startSchedule(body);

  return Response.json(body);
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id: string };
  const schedules = loadSchedules();
  const filtered = schedules.filter((s) => s.id !== id);

  if (filtered.length === schedules.length) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  saveSchedules(filtered);
  stopSchedule(id);

  return Response.json({ ok: true });
}
