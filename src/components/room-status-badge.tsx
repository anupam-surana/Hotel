import { getTranslations } from "next-intl/server";
import type { RoomStatus } from "@/generated/prisma/enums";

const COLORS: Record<RoomStatus, string> = {
  CLEAN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  DIRTY: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  OCCUPIED: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  OUT_OF_ORDER: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export async function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const t = await getTranslations("roomStatus");
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COLORS[status]}`}>
      {t(status)}
    </span>
  );
}
