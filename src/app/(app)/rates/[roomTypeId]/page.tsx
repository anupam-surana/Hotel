import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatMonthLabel, formatNumber } from "@/lib/format";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  dateKey,
  monthKey,
  parseMonthKey,
  todayKeyInTimeZone,
} from "@/lib/dates";

const WEEKDAY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
function weekdayLabel(day: Date, locale: string): string {
  const intlLocale = locale === "bn" ? "bn-IN" : "en-IN";
  let formatter = WEEKDAY_FORMATTER_CACHE.get(intlLocale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
    WEEKDAY_FORMATTER_CACHE.set(intlLocale, formatter);
  }
  return formatter.format(day);
}

export default async function RatesCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireSession();
  const { roomTypeId } = await params;
  const { month: monthParam } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("rates");
  const canManage = user.role === "OWNER" || user.role === "MANAGER";

  const [roomTypes, selectedRoomType] = await Promise.all([
    prisma.roomType.findMany({
      where: { hotelId: user.hotelId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.roomType.findFirst({
      where: { id: roomTypeId, hotelId: user.hotelId, isActive: true },
      include: { rooms: { where: { isActive: true }, select: { id: true } } },
    }),
  ]);

  if (!selectedRoomType) {
    notFound();
  }

  const now = new Date();
  const current = monthParam ? parseMonthKey(monthParam) : { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const grid = buildMonthGrid(current.year, current.month);
  const gridStart = grid[0];
  const gridEnd = addDays(grid[41], 1); // exclusive

  const physicalCount = selectedRoomType.rooms.length;

  const [overrides, bookingRooms, channelBlocks] = await Promise.all([
    prisma.rateAvailability.findMany({
      where: { hotelId: user.hotelId, roomTypeId: selectedRoomType.id, date: { gte: gridStart, lt: gridEnd } },
    }),
    prisma.bookingRoom.findMany({
      where: {
        hotelId: user.hotelId,
        roomTypeId: selectedRoomType.id,
        checkIn: { lt: gridEnd },
        checkOut: { gt: gridStart },
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      },
      select: { checkIn: true, checkOut: true },
    }),
    // Synced OTA-blocked dates reduce "remaining" here too, matching what
    // the booking guard actually enforces (see computeNightlyCapacity).
    prisma.channelBlock.findMany({
      where: {
        hotelId: user.hotelId,
        roomTypeId: selectedRoomType.id,
        startDate: { lt: gridEnd },
        endDate: { gt: gridStart },
        channelConnection: { isActive: true },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o]));
  const todayKey = todayKeyInTimeZone("Asia/Kolkata");
  const prevMonth = monthKey(new Date(Date.UTC(addMonths(current, -1).year, addMonths(current, -1).month - 1, 1)));
  const nextMonth = monthKey(new Date(Date.UTC(addMonths(current, 1).year, addMonths(current, 1).month - 1, 1)));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {roomTypes.map((rt) => (
          <Link
            key={rt.id}
            href={`/rates/${rt.id}${monthParam ? `?month=${monthParam}` : ""}`}
            className={
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium " +
              (rt.id === selectedRoomType.id
                ? "bg-primary text-primary-foreground"
                : "border border-ink/15 dark:border-sand/20")
            }
          >
            {rt.name}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/rates/${selectedRoomType.id}?month=${prevMonth}`}
          aria-label={t("prevMonth")}
          className="rounded-full border border-ink/15 px-3 py-2 text-sm dark:border-sand/20"
        >
          ‹
        </Link>
        <p className="font-semibold">{formatMonthLabel(current.year, current.month, locale)}</p>
        <Link
          href={`/rates/${selectedRoomType.id}?month=${nextMonth}`}
          aria-label={t("nextMonth")}
          className="rounded-full border border-ink/15 px-3 py-2 text-sm dark:border-sand/20"
        >
          ›
        </Link>
      </div>

      <p className="text-sm text-ink/60 dark:text-sand/60">
        {t("basePriceLabel")}: {formatCurrency(selectedRoomType.basePrice.toString(), locale)} {t("perNight")} ·{" "}
        {t("physicalRooms", { count: physicalCount })}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink/50 dark:text-sand/50">
        {grid.slice(0, 7).map((day) => (
          <div key={dateKey(day)}>{weekdayLabel(day, locale)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getUTCMonth() + 1 === current.month;
          const override = overrideByDate.get(key);
          const soldDirect = bookingRooms.filter((br) => br.checkIn <= day && day < br.checkOut).length;
          const soldViaChannels = channelBlocks.filter((b) => b.startDate <= day && day < b.endDate).length;
          const sold = soldDirect + soldViaChannels;
          const capacity = override?.closedOut ? 0 : (override?.availableOverride ?? physicalCount);
          const remaining = Math.max(0, capacity - sold);
          const price = override?.price ?? selectedRoomType.basePrice;
          const isToday = key === todayKey;
          const customized = !!override;

          const cellContent = (
            <div
              className={
                "flex h-full flex-col gap-1 rounded-lg border p-1.5 text-left " +
                (isToday ? "border-primary " : "border-ink/10 dark:border-sand/10 ") +
                (!inMonth ? "opacity-40 " : "") +
                (override?.closedOut ? "bg-red-50 dark:bg-red-500/10 " : customized ? "bg-amber-50 dark:bg-amber-500/10 " : "")
              }
            >
              <span className="text-xs font-semibold">{formatNumber(day.getUTCDate(), locale)}</span>
              {override?.closedOut ? (
                <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{t("closed")}</span>
              ) : (
                <>
                  <span className="text-[11px] font-medium">{formatCurrency(price.toString(), locale)}</span>
                  <span className="text-[11px] text-ink/50 dark:text-sand/50">
                    {formatNumber(remaining, locale)}/{formatNumber(capacity, locale)}
                  </span>
                </>
              )}
            </div>
          );

          return (
            <div key={key} className="aspect-square">
              {canManage ? (
                <Link href={`/rates/${selectedRoomType.id}/${key}`} className="block h-full">
                  {cellContent}
                </Link>
              ) : (
                cellContent
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
