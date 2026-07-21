import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { BookingSource } from "@/generated/prisma/enums";
import { addDays, dateKey } from "@/lib/dates";

export type DailySummaryRow = {
  date: Date;
  arrivals: number;
  departures: number;
  occupiedRooms: number;
  totalRooms: number;
  revenue: Prisma.Decimal;
};

export type SourceMixRow = {
  source: BookingSource;
  bookingCount: number;
  bookingValue: Prisma.Decimal;
};

// One pass over the range's bookings/payments, then a per-day scan — cheap at
// small-hotel scale (a year is 365 iterations over already-fetched arrays).
export async function computeDailySummary(
  hotelId: string,
  rangeStart: Date,
  rangeEndExclusive: Date
): Promise<DailySummaryRow[]> {
  const [totalRooms, arrivalBookings, departureBookings, bookingRooms, payments] = await Promise.all([
    prisma.room.count({ where: { hotelId, isActive: true } }),
    prisma.booking.findMany({
      where: {
        hotelId,
        checkIn: { gte: rangeStart, lt: rangeEndExclusive },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { checkIn: true },
    }),
    prisma.booking.findMany({
      where: {
        hotelId,
        checkOut: { gte: rangeStart, lt: rangeEndExclusive },
        status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      },
      select: { checkOut: true },
    }),
    prisma.bookingRoom.findMany({
      where: {
        hotelId,
        checkIn: { lt: rangeEndExclusive },
        checkOut: { gt: rangeStart },
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } },
      },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.payment.findMany({
      where: { hotelId, status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { type: true, amount: true, paidAt: true },
    }),
  ]);

  const days = Math.round((rangeEndExclusive.getTime() - rangeStart.getTime()) / 86_400_000);
  const rows: DailySummaryRow[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(rangeStart, i);
    const key = dateKey(day);

    const arrivals = arrivalBookings.filter((b) => dateKey(b.checkIn) === key).length;
    const departures = departureBookings.filter((b) => dateKey(b.checkOut) === key).length;
    const occupiedRooms = bookingRooms.filter((br) => br.checkIn <= day && day < br.checkOut).length;
    const revenue = payments
      .filter((p) => p.paidAt && dateKey(p.paidAt) === key)
      .reduce(
        (sum, p) => (p.type === "REFUND" ? sum.minus(p.amount.toString()) : sum.plus(p.amount.toString())),
        new Prisma.Decimal(0)
      );

    rows.push({ date: day, arrivals, departures, occupiedRooms, totalRooms, revenue });
  }

  return rows;
}

export async function computeSourceMix(
  hotelId: string,
  rangeStart: Date,
  rangeEndExclusive: Date
): Promise<SourceMixRow[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["source"],
    where: {
      hotelId,
      checkIn: { gte: rangeStart, lt: rangeEndExclusive },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  return grouped
    .map((g) => ({
      source: g.source,
      bookingCount: g._count._all,
      bookingValue: g._sum.totalAmount ?? new Prisma.Decimal(0),
    }))
    .sort((a, b) => b.bookingCount - a.bookingCount);
}
