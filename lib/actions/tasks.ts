"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { record } from "@/lib/activity";

export async function toggleTaskAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  // requireEvent enforces that the signed-in user owns this event before any
  // write; the taskId is then scoped to it so one host cannot tick another's.
  await requireEvent(eventId);

  const task = await db.task.findFirst({ where: { id: taskId, eventId } });
  if (!task) return;

  const nowDone = task.status !== "DONE";
  await db.task.update({
    where: { id: task.id },
    data: { status: nowDone ? "DONE" : "TODO" },
  });
  // Only ticking a task off is worth a line — un-ticking it is correcting a
  // mistake, not progress.
  if (nowDone) {
    await record(eventId, {
      actor: "host",
      kind: "task_done",
      title: `Done: ${task.title}`,
      href: `/events/${eventId}/plan`,
    });
  }
  refresh();
}
