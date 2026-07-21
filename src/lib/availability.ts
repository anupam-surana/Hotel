import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { BookingSource } from "@/generated/prisma/enums";
import { addDays, dateKey } from "@/lib/dates";

// Thrown when the requested quantity can't be met on at least one night in
// the range. Carries enough detail for the caller to show a useful message.
export class AvailabilityError extends Error {
  constructor(
    public shortfallDate: string,
    public available: number,
    public requested: number
  ) {
    super(`Not enough rooms available on ${shortfallDate}: requested ${requested}, only ${available} left`);
    this.name = "AvailabilityError";
  }
}

export class RoomTypeNotFoundError extends Error {
  constructor() {
    super("Room type not found for this hotel");
    this.name = "RoomTypeNotFoundError";
  }
}

type NightlyCapacity = {
  night: Date;
  capacity: number;
  sold: number;
  price: Prisma.Decimal;
};

// Shared by both the read-only availability check (public booking page) and
// the atomic reservation below — the same rules must produce the same
// numbers in both places, or the page would quote a price/availability it
// can't actually honor at booking time.
async function computeNightlyCapacity(
  tx: Prisma.TransactionClient,
  hotelId: string,
  roomTypeId: string,
  physicalCount: number,
  basePrice: Prisma.Decimal,
  checkIn: Date,
  checkOut: Date
): Promise<NightlyCapacity[]> {
  const [overrides, existingBookingRooms, channelBlocks] = await Promise.all([
    tx.rateAvailability.findMany({
      where: { hotelId, roomTypeId, date: { gte: checkIn, lt: checkOut } },
    }),
    tx.bookingRoom.findMany({
      where: {
        hotelId,
        roomTypeId,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      },
      select: { checkIn: true, checkOut: true },
    }),
    // OTA-blocked dates count as sold too — each ChannelBlock represents at
    // least one room of this type taken via that channel, the same way a
    // BookingRoom row represents one taken via us directly. This is how a
    // synced iCal import actually prevents overbooking, not just displays.
    tx.channelBlock.findMany({
      where: {
        hotelId,
        roomTypeId,
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
        channelConnection: { isActive: true },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o]));
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

  return Array.from({ length: nights }, (_, i) => {
    const night = addDays(checkIn, i);
    const override = overrideByDate.get(dateKey(night));
    const capacity = override?.closedOut ? 0 : (override?.availableOverride ?? physicalCount);
    const soldDirect = existingBookingRooms.filter((br) => br.checkIn <= night && night < br.checkOut).length;
    const soldViaChannels = channelBlocks.filter((b) => b.startDate <= night && night < b.endDate).length;
    const price = override?.price ?? basePrice;
    return { night, capacity, sold: soldDirect + soldViaChannels, price };
  });
}

type CreateBookingInput = {
  hotelId: string;
  guestId: string;
  roomTypeId: string;
  checkIn: Date; // UTC-midnight, inclusive
  checkOut: Date; // UTC-midnight, exclusive
  quantity: number;
  adults: number;
  children: number;
  source: BookingSource;
  notes: string | null;
  createdById: string | null; // null for guest-created bookings from the public page
};

// The atomic core of the "Front desk" module's overbooking guard: runs
// entirely inside one transaction, holding a Postgres advisory lock keyed on
// roomTypeId for the transaction's duration. That serializes concurrent
// booking attempts for the SAME room type (different room types still run
// fully in parallel) so two front-desk staff — or a staff member and a guest
// booking online at the same moment — can never both sell the last room for
// the same date. BookingRooms are created unassigned (roomId null) —
// specific room assignment happens later via assignRoom(), which has its
// own, narrower conflict check against the one physical room.
export async function createBookingAtomic(input: CreateBookingInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.roomTypeId}))`;

    const roomType = await tx.roomType.findFirst({
      where: { id: input.roomTypeId, hotelId: input.hotelId, isActive: true },
      include: { rooms: { where: { isActive: true }, select: { id: true } } },
    });
    if (!roomType) {
      throw new RoomTypeNotFoundError();
    }

    const nightly = await computeNightlyCapacity(
      tx,
      input.hotelId,
      input.roomTypeId,
      roomType.rooms.length,
      roomType.basePrice,
      input.checkIn,
      input.checkOut
    );

    let totalPricePerRoom = new Prisma.Decimal(0);
    for (const n of nightly) {
      if (n.sold + input.quantity > n.capacity) {
        throw new AvailabilityError(dateKey(n.night), Math.max(0, n.capacity - n.sold), input.quantity);
      }
      totalPricePerRoom = totalPricePerRoom.plus(n.price);
    }

    const totalAmount = totalPricePerRoom.times(input.quantity);
    const ratePerNight = totalPricePerRoom.dividedBy(nightly.length);

    return tx.booking.create({
      data: {
        hotelId: input.hotelId,
        guestId: input.guestId,
        source: input.source,
        status: "CONFIRMED",
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        notes: input.notes,
        totalAmount,
        createdById: input.createdById,
        bookingRooms: {
          create: Array.from({ length: input.quantity }, () => ({
            hotelId: input.hotelId,
            roomTypeId: input.roomTypeId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            ratePerNight,
            amount: totalPricePerRoom,
          })),
        },
      },
    });
  });
}

export type AvailabilityQuote = {
  available: number;
  pricePerRoom: Prisma.Decimal;
  nights: number;
};

// Read-only: for the public booking page to show a live price/availability
// quote before the guest commits. Not itself race-condition-safe (no lock,
// no write) — that guarantee only exists inside createBookingAtomic, which
// re-derives the same numbers under lock at the moment of booking. This is
// display-only and can go stale between the quote and the click.
export async function getAvailability(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date
): Promise<AvailabilityQuote | null> {
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights <= 0) {
    return null;
  }

  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId, isActive: true },
    include: { rooms: { where: { isActive: true }, select: { id: true } } },
  });
  if (!roomType) {
    return null;
  }

  const nightly = await computeNightlyCapacity(
    prisma,
    hotelId,
    roomTypeId,
    roomType.rooms.length,
    roomType.basePrice,
    checkIn,
    checkOut
  );

  const available = Math.min(...nightly.map((n) => Math.max(0, n.capacity - n.sold)));
  const pricePerRoom = nightly.reduce((sum, n) => sum.plus(n.price), new Prisma.Decimal(0));

  return { available, pricePerRoom, nights };
}
