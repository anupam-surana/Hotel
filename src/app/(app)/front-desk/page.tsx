import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/format";
import { parseDateKey, todayKeyInTimeZone } from "@/lib/dates";
import { BookingSourceBadge } from "@/components/booking-source-badge";

export default async function FrontDeskPage() {
  const user = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("frontDesk");

  const today = parseDateKey(todayKeyInTimeZone("Asia/Kolkata"));

  const [arrivals, departures] = await Promise.all([
    prisma.booking.findMany({
      where: { hotelId: user.hotelId, status: "CONFIRMED", checkIn: today },
      include: { guest: true, bookingRooms: { include: { roomType: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { hotelId: user.hotelId, status: "CHECKED_IN", checkOut: today },
      include: { guest: true, bookingRooms: { include: { roomType: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link
          href="/bookings/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t("newBooking")}
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("arrivals")}</h2>
        {arrivals.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">{t("noArrivals")}</p>
        )}
        <div className="flex flex-col gap-2">
          {arrivals.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{booking.guest.name}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {booking.bookingRooms[0]?.roomType.name}
                  {booking.bookingRooms.length > 1 ? ` ×${booking.bookingRooms.length}` : ""} ·{" "}
                  {formatCurrency(booking.totalAmount.toString(), locale)}
                </p>
              </div>
              <BookingSourceBadge source={booking.source} />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("departures")}</h2>
        {departures.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">{t("noDepartures")}</p>
        )}
        <div className="flex flex-col gap-2">
          {departures.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{booking.guest.name}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {booking.bookingRooms[0]?.roomType.name}
                  {booking.bookingRooms.length > 1 ? ` ×${booking.bookingRooms.length}` : ""} ·{" "}
                  {formatCurrency(booking.totalAmount.toString(), locale)}
                </p>
              </div>
              <BookingSourceBadge source={booking.source} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
