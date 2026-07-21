import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatFullDate } from "@/lib/format";
import { assignHousekeepingTask, updateHousekeepingTaskStatus } from "@/actions/housekeeping";
import { FormErrorBanner } from "@/components/form-error-banner";
import { RoomStatusBadge } from "@/components/room-status-badge";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import type { RoomStatus } from "@/generated/prisma/enums";

const STATUS_PRIORITY: Record<RoomStatus, number> = {
  DIRTY: 0,
  OUT_OF_ORDER: 1,
  OCCUPIED: 2,
  CLEAN: 3,
};

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const;

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();
  const tTaskStatus = await getTranslations("housekeepingStatus");
  const canAssign = user.role === "OWNER" || user.role === "MANAGER";

  const [rooms, housekeepingStaff] = await Promise.all([
    prisma.room.findMany({
      where: { hotelId: user.hotelId, isActive: true },
      include: {
        roomType: true,
        housekeepingTasks: {
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          include: { assignedTo: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    canAssign
      ? prisma.user.findMany({
          where: { hotelId: user.hotelId, role: "HOUSEKEEPING", isActive: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const sortedRooms = [...rooms].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.roomNumber.localeCompare(b.roomNumber)
  );

  const taskStatusOptions = TASK_STATUSES.map((s) => ({ value: s, label: tTaskStatus(s) }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("housekeeping.title")}</h1>
      <FormErrorBanner code={error} />

      <div className="flex flex-col gap-2">
        {sortedRooms.map((room) => {
          const needsAttention = room.status === "DIRTY" || room.status === "OUT_OF_ORDER";
          const task = room.housekeepingTasks[0];

          return (
            <div
              key={room.id}
              className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{room.roomNumber}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">{room.roomType.name}</p>
                </div>
                <RoomStatusBadge status={room.status} />
              </div>

              {needsAttention && task && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-black/5 p-2 dark:bg-white/10">
                  <div className="text-xs">
                    <p className="font-medium">{task.assignedTo?.name}</p>
                    {task.dueDate && (
                      <p className="text-black/50 dark:text-white/50">
                        {t("housekeeping.due")}: {formatFullDate(task.dueDate, locale)}
                      </p>
                    )}
                    {task.notes && <p className="text-black/70 dark:text-white/70">{task.notes}</p>}
                  </div>
                  <form action={updateHousekeepingTaskStatus.bind(null, task.id)}>
                    <AutoSubmitSelect
                      name="status"
                      defaultValue={task.status}
                      options={taskStatusOptions}
                      className="rounded-full border border-black/15 bg-transparent px-3 py-1.5 text-xs font-medium dark:border-white/20"
                    />
                  </form>
                </div>
              )}

              {needsAttention && !task && canAssign && (
                <form
                  action={assignHousekeepingTask.bind(null, room.id)}
                  className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-2 dark:border-white/20"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      name="assignedToId"
                      required
                      className="rounded-lg border border-black/15 px-2.5 py-2 text-xs dark:border-white/20 dark:bg-white/5"
                    >
                      <option value="" disabled>
                        {t("housekeeping.chooseStaff")}
                      </option>
                      {housekeepingStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      name="dueDate"
                      className="rounded-lg border border-black/15 px-2.5 py-2 text-xs dark:border-white/20 dark:bg-white/5"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                  >
                    {t("housekeeping.assign")}
                  </button>
                </form>
              )}

              {needsAttention && !task && !canAssign && (
                <p className="text-xs text-black/50 dark:text-white/50">{t("housekeeping.notAssigned")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
