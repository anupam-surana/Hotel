"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AvailabilityError, RoomTypeNotFoundError } from "@/lib/availability";
import { resolveGuestAndCreateBooking } from "@/lib/booking-creation";
import { decryptSecret } from "@/lib/crypto";
import { createPaymentLink, RazorpayError } from "@/lib/razorpay";
import { parseDateKey } from "@/lib/dates";

// No auth on this file by design — these actions are called from the public
// guest-facing /h/[slug] pages. Every query below is still scoped by the
// hotel resolved from the slug, so a request can never touch another
// hotel's data. (Abuse/rate-limiting for a public form is an infra-level
// concern — reverse proxy or WAF — deliberately left out of V1 app code.)

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function createPublicBooking(hotelSlug: string, formData: FormData) {
  const hotel = await prisma.hotel.findFirst({ where: { slug: hotelSlug, isActive: true } });
  if (!hotel) {
    withError(`/h/${hotelSlug}`, "validation");
  }

  const guestName = ((formData.get("guestName") as string) || "").trim();
  const guestPhone = ((formData.get("guestPhone") as string) || "").trim();
  const guestEmail = ((formData.get("guestEmail") as string) || "").trim();
  const checkInStr = (formData.get("checkIn") as string) || "";
  const checkOutStr = (formData.get("checkOut") as string) || "";
  const roomTypeId = (formData.get("roomTypeId") as string) || "";
  const quantityRaw = (formData.get("quantity") as string) || "1";
  const adultsRaw = (formData.get("adults") as string) || "";
  const childrenRaw = (formData.get("children") as string) || "";

  const backPath = `/h/${hotelSlug}/book?roomTypeId=${roomTypeId}&checkIn=${checkInStr}&checkOut=${checkOutStr}&quantity=${quantityRaw}`;

  if (!guestName || !guestPhone || !roomTypeId) {
    withError(backPath, "validation");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInStr) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutStr)) {
    withError(backPath, "validation");
  }

  const checkIn = parseDateKey(checkInStr);
  const checkOut = parseDateKey(checkOutStr);
  if (checkOut <= checkIn) {
    withError(backPath, "invalidDates");
  }

  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    withError(backPath, "validation");
  }
  const adults = Number.isInteger(Number(adultsRaw)) && Number(adultsRaw) > 0 ? Number(adultsRaw) : 1;
  const children = Number.isInteger(Number(childrenRaw)) && Number(childrenRaw) >= 0 ? Number(childrenRaw) : 0;

  const locale = await getLocale();

  let bookingId: string;
  try {
    const booking = await resolveGuestAndCreateBooking({
      hotelId: hotel.id,
      hotelName: hotel.name,
      hotelSlug: hotel.slug,
      guestName,
      guestPhone,
      guestEmail,
      roomTypeId,
      checkIn,
      checkOut,
      quantity,
      adults,
      children,
      source: "DIRECT",
      notes: null,
      createdById: null,
      locale,
    });
    bookingId = booking.id;
  } catch (error) {
    if (error instanceof AvailabilityError) {
      withError(backPath, "unavailable");
    }
    if (error instanceof RoomTypeNotFoundError) {
      withError(backPath, "validation");
    }
    throw error;
  }

  redirect(`/h/${hotelSlug}/confirmation/${bookingId}`);
}

export async function generatePublicPaymentLink(hotelSlug: string, bookingId: string, formData: FormData) {
  const backPath = `/h/${hotelSlug}/confirmation/${bookingId}`;

  const hotel = await prisma.hotel.findFirst({ where: { slug: hotelSlug, isActive: true } });
  if (!hotel) {
    withError(backPath, "validation");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: hotel.id },
    include: { guest: true },
  });
  if (!booking) {
    withError(backPath, "validation");
  }

  const razorpaySettings = await prisma.razorpaySettings.findUnique({ where: { hotelId: hotel.id } });
  if (!razorpaySettings || !razorpaySettings.isActive) {
    withError(backPath, "razorpayNotConnected");
  }

  const amountRaw = ((formData.get("amount") as string) || "").trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(amountRaw) || Number(amountRaw) <= 0) {
    withError(backPath, "validation");
  }

  let link;
  try {
    link = await createPaymentLink({
      keyId: razorpaySettings.keyId,
      keySecret: decryptSecret(razorpaySettings.keySecret),
      amountRupees: Number(amountRaw),
      description: `Booking payment — ${booking.guest.name}`,
      referenceId: booking.id,
      customerName: booking.guest.name,
      customerContact: booking.guest.phone ?? undefined,
      customerEmail: booking.guest.email ?? undefined,
    });
  } catch (error) {
    if (error instanceof RazorpayError) {
      withError(backPath, "razorpayError");
    }
    throw error;
  }

  await prisma.payment.create({
    data: {
      hotelId: hotel.id,
      bookingId: booking.id,
      type: "PAYMENT",
      method: "RAZORPAY",
      status: "PENDING",
      amount: amountRaw,
      razorpayLinkId: link.id,
      razorpayShortUrl: link.shortUrl,
    },
  });

  redirect(link.shortUrl);
}
