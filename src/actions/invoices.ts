"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { hotelInvoicePrefix, gstRateForNightlyTariff } from "@/lib/invoice";

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

// GST invoices are only generated for completed stays: the taxable amount
// must be final, and Indian GST law treats a corrected already-issued
// invoice as requiring a credit note (out of scope for V1) rather than an
// edit — so we simply don't allow generating one until the booking can no
// longer change.
export async function generateInvoice(bookingId: string) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");
  const backPath = `/bookings/${bookingId}`;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: { guest: true, bookingRooms: true, invoice: true, hotel: true },
  });
  if (!booking) {
    withError("/bookings", "validation");
  }
  if (booking.status !== "CHECKED_OUT") {
    withError(backPath, "invoiceNotCheckedOut");
  }
  if (booking.invoice) {
    withError(backPath, "invoiceAlreadyExists");
  }

  const nights = Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000);
  const quantity = booking.bookingRooms.length;
  const avgNightlyRate = booking.totalAmount.dividedBy(nights * quantity);
  const { cgstRate, sgstRate } = gstRateForNightlyTariff(avgNightlyRate);

  const taxableAmount = booking.totalAmount;
  const cgstAmount = taxableAmount.times(cgstRate).dividedBy(100);
  const sgstAmount = taxableAmount.times(sgstRate).dividedBy(100);
  const totalAmount = taxableAmount.plus(cgstAmount).plus(sgstAmount);

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

  await prisma.$transaction(async (tx) => {
    // Advisory lock (keyed per hotel, distinct namespace from the room-type
    // booking lock) so two invoices generated at once can't land on the
    // same sequence number.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.hotelId + ":invoice"}))`;

    const issuedThisYear = await tx.invoice.count({
      where: { hotelId: user.hotelId, issueDate: { gte: yearStart, lt: yearEnd } },
    });
    const sequence = issuedThisYear + 1;
    const invoiceNumber = `${hotelInvoicePrefix(booking.hotel.name)}/${now.getUTCFullYear()}/${String(sequence).padStart(4, "0")}`;

    await tx.invoice.create({
      data: {
        hotelId: user.hotelId,
        bookingId: booking.id,
        invoiceNumber,
        issueDate: now,
        guestName: booking.guest.name,
        placeOfSupply: booking.hotel.state || "",
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        totalAmount,
      },
    });
  });

  revalidatePath(backPath);
  redirect(`/invoices/${booking.id}`);
}
