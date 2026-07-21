import { prisma } from "@/lib/prisma";
import { addDays, dateKey } from "@/lib/dates";

// How far ahead to expose availability in the export feed — far enough to
// cover typical OTA booking windows, bounded so a daily scan stays cheap.
const EXPORT_WINDOW_DAYS = 365;

// Scans the window day-by-day and collapses fully-booked (capacity - sold
// <= 0) consecutive days into ranges, for the iCal export feed. This is
// informational for OTAs, not the safety-critical path — the atomic
// reservation in availability.ts is what actually prevents overbooking, and
// intentionally duplicates rather than shares this day-by-day scan since
// this one has no price computation and runs outside any transaction.
export async function computeBlockedRanges(
  hotelId: string,
  roomTypeId: string
): Promise<{ startDate: Date; endDate: Date }[]> {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId, isActive: true },
    include: { rooms: { where: { isActive: true }, select: { id: true } } },
  });
  if (!roomType) {
    return [];
  }

  const physicalCount = roomType.rooms.length;
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = addDays(windowStart, EXPORT_WINDOW_DAYS);

  const [overrides, bookingRooms, channelBlocks] = await Promise.all([
    prisma.rateAvailability.findMany({
      where: { hotelId, roomTypeId, date: { gte: windowStart, lt: windowEnd } },
      select: { date: true, closedOut: true, availableOverride: true },
    }),
    prisma.bookingRoom.findMany({
      where: {
        hotelId,
        roomTypeId,
        checkIn: { lt: windowEnd },
        checkOut: { gt: windowStart },
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.channelBlock.findMany({
      where: {
        hotelId,
        roomTypeId,
        startDate: { lt: windowEnd },
        endDate: { gt: windowStart },
        channelConnection: { isActive: true },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o]));
  const days = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000);

  const ranges: { startDate: Date; endDate: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(windowStart, i);
    const override = overrideByDate.get(dateKey(day));
    const capacity = override?.closedOut ? 0 : (override?.availableOverride ?? physicalCount);
    const sold =
      bookingRooms.filter((br) => br.checkIn <= day && day < br.checkOut).length +
      channelBlocks.filter((b) => b.startDate <= day && day < b.endDate).length;

    if (sold < capacity) {
      continue;
    }

    const last = ranges[ranges.length - 1];
    if (last && dateKey(last.endDate) === dateKey(day)) {
      last.endDate = addDays(day, 1);
    } else {
      ranges.push({ startDate: day, endDate: addDays(day, 1) });
    }
  }

  return ranges;
}
