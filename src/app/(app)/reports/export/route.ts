import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { addDays, dateKey, parseDateKey } from "@/lib/dates";
import { computeDailySummary } from "@/lib/reports";
import { toCsv } from "@/lib/csv";

// Route Handlers aren't wrapped by the (app) layout's auth check, so this
// re-verifies independently — same rule as every Server Action in this app.
export async function GET(request: NextRequest) {
  const user = await requireApiRole("OWNER", "MANAGER");

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultEndInclusive = addDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)), -1);

  const rangeStart = from ? parseDateKey(from) : defaultStart;
  const rangeEndInclusive = to ? parseDateKey(to) : defaultEndInclusive;
  const rangeEndExclusive = addDays(rangeEndInclusive, 1);

  const rows = await computeDailySummary(user.hotelId, rangeStart, rangeEndExclusive);

  const csv = toCsv(
    ["Date", "Arrivals", "Departures", "Occupancy %", "Revenue (INR)"],
    rows.map((row) => [
      dateKey(row.date),
      row.arrivals,
      row.departures,
      row.totalRooms > 0 ? Math.round((row.occupiedRooms / row.totalRooms) * 100) : 0,
      row.revenue.toString(),
    ])
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daily-summary-${dateKey(rangeStart)}-to-${dateKey(rangeEndInclusive)}.csv"`,
    },
  });
}
