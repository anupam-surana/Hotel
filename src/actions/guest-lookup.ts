"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

// Public — no session. The two-factor lookup (booking id + matching phone)
// already happened to get the guest to this page; re-validate the phone
// here too rather than trusting the bare bookingId in the form post.
export async function requestGuestCancellation(hotelSlug: string, bookingId: string, formData: FormData) {
  const phone = ((formData.get("phone") as string) || "").trim();
  const backPath = `/h/${hotelSlug}/my-booking?bookingId=${bookingId}&phone=${encodeURIComponent(phone)}`;

  const hotel = await prisma.hotel.findFirst({ where: { slug: hotelSlug, isActive: true } });
  if (!hotel) {
    withError(`/h/${hotelSlug}/my-booking`, "validation");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: hotel.id, guest: { phone } },
  });
  if (!booking || booking.status !== "CONFIRMED") {
    withError(backPath, "validation");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "Cancelled by guest via self-service",
    },
  });

  redirect(`/h/${hotelSlug}/my-booking?bookingId=${bookingId}&phone=${encodeURIComponent(phone)}`);
}
