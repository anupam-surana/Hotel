import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/format";
import { parseDateKey } from "@/lib/dates";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { BookingSourceBadge } from "@/components/booking-source-badge";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { summarizePayments } from "@/lib/payments";
import type { BookingSource, BookingStatus } from "@/generated/prisma/enums";

const STATUSES: BookingStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];
const SOURCES: BookingSource[] = ["DIRECT", "WALK_IN", "BOOKING_COM", "AGODA", "AIRBNB", "MMT"];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; from?: string; to?: string }>;
}) {
  const user = await requireSession();
  const { status, source, from, to } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId: user.hotelId,
      ...(status ? { status: status as BookingStatus } : {}),
      ...(source ? { source: source as BookingSource } : {}),
      ...(from || to
        ? {
            checkIn: {
              ...(from ? { gte: parseDateKey(from) } : {}),
              ...(to ? { lte: parseDateKey(to) } : {}),
            },
          }
        : {}),
    },
    include: { guest: true, bookingRooms: { include: { roomType: true } }, payments: true },
    orderBy: { checkIn: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("bookings.title")}</h1>
        <Link
          href="/bookings/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t("frontDesk.newBooking")}
        </Link>
      </div>

      <form method="get" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          >
            <option value="">{t("bookings.allStatuses")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`bookingStatus.${s}`)}
              </option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={source ?? ""}
            className="rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          >
            <option value="">{t("bookings.allSources")}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`bookingSource.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          />
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-medium dark:border-white/20"
        >
          {t("common.search")}
        </button>
      </form>

      {bookings.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
          {t("bookings.noBookings")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{booking.guest.name}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {new Intl.DateTimeFormat(locale === "bn" ? "bn-IN" : "en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(booking.checkIn)}{" "}
                  →{" "}
                  {new Intl.DateTimeFormat(locale === "bn" ? "bn-IN" : "en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(booking.checkOut)}
                </p>
              </div>
              <p className="shrink-0 font-semibold">{formatCurrency(booking.totalAmount.toString(), locale)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BookingStatusBadge status={booking.status} />
              <BookingSourceBadge source={booking.source} />
              {(booking.status === "CONFIRMED" ||
                booking.status === "CHECKED_IN" ||
                booking.status === "CHECKED_OUT") && (
                <PaymentStatusBadge status={summarizePayments(booking.payments, booking.totalAmount).status} />
              )}
              <span className="text-xs text-black/50 dark:text-white/50">
                {booking.bookingRooms[0]?.roomType.name}
                {booking.bookingRooms.length > 1 ? ` ×${booking.bookingRooms.length}` : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
