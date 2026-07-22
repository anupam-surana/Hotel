import { prisma } from "@/lib/prisma";
import { createBookingAtomic } from "@/lib/availability";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { formatFullDate, formatCurrency } from "@/lib/format";
import type { BookingSource } from "@/generated/prisma/enums";

// Shared by the staff-facing (src/actions/bookings.ts) and guest-facing
// (src/actions/public-booking.ts) booking creation paths — same guest
// lookup-or-create + atomic reservation + best-effort confirmation email,
// so the two flows can't silently drift from each other.
export type ResolveGuestAndCreateBookingInput = {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  quantity: number;
  adults: number;
  children: number;
  source: BookingSource;
  notes: string | null;
  createdById: string | null;
  locale: string;
};

export async function resolveGuestAndCreateBooking(input: ResolveGuestAndCreateBookingInput) {
  let guest = await prisma.guest.findFirst({ where: { hotelId: input.hotelId, phone: input.guestPhone } });
  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        hotelId: input.hotelId,
        name: input.guestName,
        phone: input.guestPhone,
        email: input.guestEmail || null,
      },
    });
  }

  const booking = await createBookingAtomic({
    hotelId: input.hotelId,
    guestId: guest.id,
    roomTypeId: input.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    quantity: input.quantity,
    adults: input.adults,
    children: input.children,
    source: input.source,
    notes: input.notes,
    createdById: input.createdById,
  });

  if (guest.email) {
    // Best-effort — an email provider hiccup must never fail the booking.
    try {
      const roomType = await prisma.roomType.findUnique({
        where: { id: input.roomTypeId },
        select: { name: true },
      });
      await sendBookingConfirmationEmail(guest.email, {
        guestName: guest.name,
        hotelName: input.hotelName,
        checkIn: formatFullDate(input.checkIn, input.locale),
        checkOut: formatFullDate(input.checkOut, input.locale),
        roomTypeName: roomType?.name ?? "",
        totalAmount: formatCurrency(booking.totalAmount.toString(), input.locale),
        hotelSlug: input.hotelSlug,
        bookingId: booking.id,
      });
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
    }
  }

  return booking;
}
