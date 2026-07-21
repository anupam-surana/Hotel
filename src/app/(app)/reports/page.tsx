import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatNumber, formatShortDate } from "@/lib/format";
import { addDays, dateKey, parseDateKey } from "@/lib/dates";
import { computeDailySummary, computeSourceMix } from "@/lib/reports";
import { Prisma } from "@/generated/prisma/client";
import { StatTile } from "@/components/stat-tile";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireRole("OWNER", "MANAGER");
  const { from, to } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();
  const tSource = await getTranslations("bookingSource");

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultEndInclusive = addDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)), -1);

  const rangeStart = from ? parseDateKey(from) : defaultStart;
  const rangeEndInclusive = to ? parseDateKey(to) : defaultEndInclusive;
  const rangeEndExclusive = addDays(rangeEndInclusive, 1);

  const [dailyRows, sourceMix] = await Promise.all([
    computeDailySummary(user.hotelId, rangeStart, rangeEndExclusive),
    computeSourceMix(user.hotelId, rangeStart, rangeEndExclusive),
  ]);

  const totalRevenue = dailyRows.reduce((sum, r) => sum.plus(r.revenue), new Prisma.Decimal(0));
  const totalBookings = sourceMix.reduce((sum, s) => sum + s.bookingCount, 0);
  const avgOccupancyPct =
    dailyRows.length > 0
      ? Math.round(
          (dailyRows.reduce((sum, r) => sum + (r.totalRooms > 0 ? r.occupiedRooms / r.totalRooms : 0), 0) /
            dailyRows.length) *
            100
        )
      : 0;

  const exportHref = `/reports/export?from=${dateKey(rangeStart)}&to=${dateKey(rangeEndInclusive)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{t("reports.title")}</h1>

      <form method="get" className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="from" className="text-xs font-medium">
            {t("reports.dateFrom")}
          </label>
          <input
            type="date"
            id="from"
            name="from"
            defaultValue={dateKey(rangeStart)}
            className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="to" className="text-xs font-medium">
            {t("reports.dateTo")}
          </label>
          <input
            type="date"
            id="to"
            name="to"
            defaultValue={dateKey(rangeEndInclusive)}
            className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-white/5"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-medium dark:border-white/20"
        >
          {t("reports.apply")}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t("reports.totalRevenue")} value={formatCurrency(totalRevenue.toString(), locale)} />
        <StatTile label={t("reports.totalBookings")} value={formatNumber(totalBookings, locale)} />
        <StatTile label={t("reports.avgOccupancy")} value={`${formatNumber(avgOccupancyPct, locale)}%`} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("reports.sourceMix")}</h2>
        {sourceMix.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">{t("reports.noData")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sourceMix.map((row) => {
              const pct = totalBookings > 0 ? Math.round((row.bookingCount / totalBookings) * 100) : 0;
              return (
                <div key={row.source} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{tSource(row.source)}</span>
                    <span className="text-black/60 dark:text-white/60">
                      {formatNumber(row.bookingCount, locale)} ·{" "}
                      {formatCurrency(row.bookingValue.toString(), locale)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/15">
                    <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("reports.dailySummary")}</h2>
          <Link href={exportHref} className="text-sm font-medium text-black/60 dark:text-white/60">
            {t("reports.exportCsv")}
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="px-3 py-2 font-medium">{t("reports.date")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.arrivals")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.departures")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.occupancy")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("reports.revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={dateKey(row.date)} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-3 py-2">{formatShortDate(row.date, locale)}</td>
                  <td className="px-3 py-2">{formatNumber(row.arrivals, locale)}</td>
                  <td className="px-3 py-2">{formatNumber(row.departures, locale)}</td>
                  <td className="px-3 py-2">
                    {row.totalRooms > 0 ? Math.round((row.occupiedRooms / row.totalRooms) * 100) : 0}%
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.revenue.toString(), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
