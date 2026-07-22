import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { addDays, parseDateKey, todayKeyInTimeZone } from "@/lib/dates";
import { Prisma } from "@/generated/prisma/client";
import { StatTile } from "@/components/stat-tile";
import { Meter } from "@/components/meter";

function netRevenue(payments: { type: string; amount: Prisma.Decimal }[]): Prisma.Decimal {
  return payments.reduce(
    (sum, p) => (p.type === "REFUND" ? sum.minus(p.amount.toString()) : sum.plus(p.amount.toString())),
    new Prisma.Decimal(0)
  );
}

export default async function DashboardPage() {
  const user = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations();

  const today = parseDateKey(todayKeyInTimeZone("Asia/Kolkata"));
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const [
    arrivals,
    departures,
    occupiedCount,
    totalRooms,
    paymentsToday,
    paymentsMonth,
    upcoming,
    cancellations,
    roomTypeCount,
  ] = await Promise.all([
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
    prisma.room.count({ where: { hotelId: user.hotelId, isActive: true, status: "OCCUPIED" } }),
    prisma.room.count({ where: { hotelId: user.hotelId, isActive: true } }),
    prisma.payment.findMany({
      where: { hotelId: user.hotelId, status: "PAID", paidAt: { gte: today, lt: tomorrow } },
      select: { type: true, amount: true },
    }),
    prisma.payment.findMany({
      where: { hotelId: user.hotelId, status: "PAID", paidAt: { gte: monthStart, lt: monthEnd } },
      select: { type: true, amount: true },
    }),
    prisma.booking.findMany({
      where: { hotelId: user.hotelId, status: "CONFIRMED", checkIn: { gt: today } },
      include: { guest: true },
      orderBy: { checkIn: "asc" },
    }),
    prisma.booking.findMany({
      where: { hotelId: user.hotelId, status: "CANCELLED", cancelledAt: { gte: weekAgo } },
      include: { guest: true },
      orderBy: { cancelledAt: "desc" },
    }),
    prisma.roomType.count({ where: { hotelId: user.hotelId, isActive: true } }),
  ]);

  const revenueToday = netRevenue(paymentsToday);
  const revenueMonth = netRevenue(paymentsMonth);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>

      {user.role === "OWNER" && roomTypeCount === 0 && (
        <Link
          href="/onboarding"
          className="rounded-xl border border-ink/15 bg-ink/5 px-4 py-3.5 text-sm font-semibold dark:border-sand/20 dark:bg-sand/5"
        >
          {t("dashboard.finishSetup")}
        </Link>
      )}

      <div className="rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
        <Meter label={t("dashboard.occupancy")} value={occupiedCount} max={totalRooms} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t("dashboard.revenueToday")} value={formatCurrency(revenueToday.toString(), locale)} />
        <StatTile label={t("dashboard.revenueMonth")} value={formatCurrency(revenueMonth.toString(), locale)} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {t("dashboard.todayArrivals")} ({arrivals.length})
          </h2>
          <Link href="/front-desk" className="text-sm font-medium text-ink/60 dark:text-sand/60">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        {arrivals.length === 0 ? (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("dashboard.noArrivals")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {arrivals.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
              >
                <p className="truncate font-medium">{b.guest.name}</p>
                <p className="shrink-0 text-sm text-ink/60 dark:text-sand/60">
                  {b.bookingRooms[0]?.roomType.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {t("dashboard.todayDepartures")} ({departures.length})
          </h2>
          <Link href="/front-desk" className="text-sm font-medium text-ink/60 dark:text-sand/60">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        {departures.length === 0 ? (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("dashboard.noDepartures")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {departures.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
              >
                <p className="truncate font-medium">{b.guest.name}</p>
                <p className="shrink-0 text-sm text-ink/60 dark:text-sand/60">
                  {b.bookingRooms[0]?.roomType.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {t("dashboard.upcomingBookings")} ({upcoming.length})
          </h2>
          <Link href="/bookings?status=CONFIRMED" className="text-sm font-medium text-ink/60 dark:text-sand/60">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("dashboard.noUpcomingBookings")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
              >
                <p className="truncate font-medium">{b.guest.name}</p>
                <p className="shrink-0 text-sm text-ink/60 dark:text-sand/60">
                  {formatFullDate(b.checkIn, locale)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {cancellations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {t("dashboard.cancellations")} ({cancellations.length})
            </h2>
            <Link href="/bookings?status=CANCELLED" className="text-sm font-medium text-ink/60 dark:text-sand/60">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {cancellations.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
              >
                <p className="truncate font-medium">{b.guest.name}</p>
                <p className="shrink-0 text-sm text-ink/60 dark:text-sand/60">
                  {b.cancelledAt && formatFullDate(b.cancelledAt, locale)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
