import { getTranslations } from "next-intl/server";
import type { BookingStatus } from "@/generated/prisma/enums";

const COLORS: Record<BookingStatus, string> = {
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  CHECKED_IN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  CHECKED_OUT: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  NO_SHOW: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

export async function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = await getTranslations("bookingStatus");
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COLORS[status]}`}>
      {t(status)}
    </span>
  );
}
