"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { AvailabilityError, RoomTypeNotFoundError } from "@/lib/availability";
import { resolveGuestAndCreateBooking } from "@/lib/booking-creation";
import { parseDateKey } from "@/lib/dates";
import type { BookingSource } from "@/generated/prisma/enums";

const SOURCES = ["DIRECT", "WALK_IN", "BOOKING_COM", "AGODA", "AIRBNB", "MMT"] as const;

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function createBooking(formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const guestName = ((formData.get("guestName") as string) || "").trim();
  const guestPhone = ((formData.get("guestPhone") as string) || "").trim();
  const guestEmail = ((formData.get("guestEmail") as string) || "").trim();
  const checkInStr = (formData.get("checkIn") as string) || "";
  const checkOutStr = (formData.get("checkOut") as string) || "";
  const roomTypeId = (formData.get("roomTypeId") as string) || "";
  const quantityRaw = (formData.get("quantity") as string) || "";
  const adultsRaw = (formData.get("adults") as string) || "";
  const childrenRaw = (formData.get("children") as string) || "";
  const sourceRaw = (formData.get("source") as string) || "";
  const notes = ((formData.get("notes") as string) || "").trim();

  if (!guestName || !guestPhone || !roomTypeId) {
    withError("/bookings/new", "validation");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInStr) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutStr)) {
    withError("/bookings/new", "validation");
  }

  const checkIn = parseDateKey(checkInStr);
  const checkOut = parseDateKey(checkOutStr);
  if (checkOut <= checkIn) {
    withError("/bookings/new", "invalidDates");
  }

  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    withError("/bookings/new", "validation");
  }
  const adults = Number.isInteger(Number(adultsRaw)) && Number(adultsRaw) > 0 ? Number(adultsRaw) : 1;
  const children = Number.isInteger(Number(childrenRaw)) && Number(childrenRaw) >= 0 ? Number(childrenRaw) : 0;
  const source: BookingSource = (SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as BookingSource)
    : "WALK_IN";

  const locale = await getLocale();

  try {
    const booking = await resolveGuestAndCreateBooking({
      hotelId: user.hotelId,
      hotelName: user.hotelName,
      hotelSlug: user.hotelSlug,
      guestName,
      guestPhone,
      guestEmail,
      roomTypeId,
      checkIn,
      checkOut,
      quantity,
      adults,
      children,
      source,
      notes: notes || null,
      createdById: user.id,
      locale,
    });

    revalidatePath("/bookings");
    revalidatePath("/front-desk");
    redirect(`/bookings/${booking.id}`);
  } catch (error) {
    if (error instanceof AvailabilityError) {
      withError("/bookings/new", "unavailable");
    }
    if (error instanceof RoomTypeNotFoundError) {
      withError("/bookings/new", "validation");
    }
    throw error;
  }
}

export async function assignRoom(bookingRoomId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const bookingRoom = await prisma.bookingRoom.findFirst({
    where: { id: bookingRoomId, hotelId: user.hotelId },
  });
  if (!bookingRoom) {
    withError("/bookings", "validation");
  }
  const backPath = `/bookings/${bookingRoom.bookingId}`;
  const roomIdRaw = (formData.get("roomId") as string) || "";

  if (!roomIdRaw) {
    await prisma.bookingRoom.update({ where: { id: bookingRoomId }, data: { roomId: null } });
    revalidatePath(backPath);
    return;
  }

  const room = await prisma.room.findFirst({
    where: { id: roomIdRaw, hotelId: user.hotelId, roomTypeId: bookingRoom.roomTypeId, isActive: true },
  });
  if (!room) {
    withError(backPath, "validation");
  }

  const conflict = await prisma.bookingRoom.findFirst({
    where: {
      roomId: roomIdRaw,
      hotelId: user.hotelId,
      id: { not: bookingRoomId },
      checkIn: { lt: bookingRoom.checkOut },
      checkOut: { gt: bookingRoom.checkIn },
      booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    },
  });
  if (conflict) {
    withError(backPath, "roomConflict");
  }

  await prisma.bookingRoom.update({ where: { id: bookingRoomId }, data: { roomId: roomIdRaw } });
  revalidatePath(backPath);
}

export async function checkInBooking(bookingId: string) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: { bookingRooms: true },
  });
  if (!booking || booking.status !== "CONFIRMED") {
    withError(`/bookings/${bookingId}`, "validation");
  }
  if (booking.bookingRooms.some((br) => !br.roomId)) {
    withError(`/bookings/${bookingId}`, "notAllRoomsAssigned");
  }

  const roomIds = booking.bookingRooms.map((br) => br.roomId as string);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_IN" } }),
    prisma.room.updateMany({ where: { id: { in: roomIds }, hotelId: user.hotelId }, data: { status: "OCCUPIED" } }),
  ]);

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/front-desk");
  revalidatePath("/rooms");
}

export async function checkOutBooking(bookingId: string) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: { bookingRooms: true },
  });
  if (!booking || booking.status !== "CHECKED_IN") {
    withError(`/bookings/${bookingId}`, "validation");
  }

  const roomIds = booking.bookingRooms.map((br) => br.roomId).filter((id): id is string => !!id);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_OUT" } }),
    prisma.room.updateMany({ where: { id: { in: roomIds }, hotelId: user.hotelId }, data: { status: "DIRTY" } }),
  ]);

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/front-desk");
  revalidatePath("/rooms");
}

export async function cancelBooking(bookingId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId: user.hotelId } });
  if (!booking || booking.status !== "CONFIRMED") {
    withError(`/bookings/${bookingId}`, "validation");
  }
  const reason = ((formData.get("reason") as string) || "").trim();

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason || null },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/front-desk");
}

export async function markNoShow(bookingId: string) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId: user.hotelId } });
  if (!booking || booking.status !== "CONFIRMED") {
    withError(`/bookings/${bookingId}`, "validation");
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "NO_SHOW" } });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/front-desk");
}
