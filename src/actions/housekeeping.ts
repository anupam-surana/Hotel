"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole, requireApiSession } from "@/lib/auth/session";
import { parseDateKey } from "@/lib/dates";

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const;
const BACK_PATH = "/housekeeping";

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

// Deciding who's responsible for a room is a staffing call, so only
// OWNER/MANAGER can assign — but anyone can update progress (see below),
// since the person actually cleaning shouldn't need a manager nearby to
// mark it done.
export async function assignHousekeepingTask(roomId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");

  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
  if (!room) {
    withError(BACK_PATH, "validation");
  }

  const assignedToId = (formData.get("assignedToId") as string) || "";
  if (!assignedToId) {
    withError(BACK_PATH, "validation");
  }
  const assignee = await prisma.user.findFirst({
    where: { id: assignedToId, hotelId: user.hotelId, role: "HOUSEKEEPING", isActive: true },
  });
  if (!assignee) {
    withError(BACK_PATH, "validation");
  }

  const dueDateRaw = (formData.get("dueDate") as string) || "";
  const notes = ((formData.get("notes") as string) || "").trim();
  const data = {
    assignedToId: assignee.id,
    notes: notes || null,
    dueDate: dueDateRaw ? parseDateKey(dueDateRaw) : null,
  };

  // One active task per room: reassigning/updating an already-pending task
  // rather than piling up duplicates.
  const existingActive = await prisma.housekeepingTask.findFirst({
    where: { hotelId: user.hotelId, roomId, status: { in: ["PENDING", "IN_PROGRESS"] } },
  });

  if (existingActive) {
    await prisma.housekeepingTask.update({ where: { id: existingActive.id }, data });
  } else {
    await prisma.housekeepingTask.create({
      data: { hotelId: user.hotelId, roomId, status: "PENDING", ...data },
    });
  }

  revalidatePath(BACK_PATH);
}

export async function updateHousekeepingTaskStatus(taskId: string, formData: FormData) {
  const user = await requireApiSession();

  const task = await prisma.housekeepingTask.findFirst({ where: { id: taskId, hotelId: user.hotelId } });
  if (!task) {
    withError(BACK_PATH, "validation");
  }

  const statusRaw = (formData.get("status") as string) || "";
  if (!(TASK_STATUSES as readonly string[]).includes(statusRaw)) {
    withError(BACK_PATH, "validation");
  }
  const status = statusRaw as (typeof TASK_STATUSES)[number];

  if (status === "DONE") {
    // Finishing the task is what actually makes the room clean again.
    await prisma.$transaction([
      prisma.housekeepingTask.update({ where: { id: taskId }, data: { status, completedAt: new Date() } }),
      prisma.room.updateMany({ where: { id: task.roomId, hotelId: user.hotelId }, data: { status: "CLEAN" } }),
    ]);
  } else {
    await prisma.housekeepingTask.update({ where: { id: taskId }, data: { status, completedAt: null } });
  }

  revalidatePath(BACK_PATH);
  revalidatePath("/rooms");
}
