"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole, requireApiSession } from "@/lib/auth/session";

const roomTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  maxAdults: z.coerce.number().int().min(1).max(20),
  maxChildren: z.coerce.number().int().min(0).max(20),
  basePrice: z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/),
  // Single photo URL for V1 — no upload/storage infra yet, so owners paste a
  // link to an image hosted elsewhere. Shown on the public booking page.
  photoUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
});

const roomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.string().trim().max(20).optional(),
});

const ROOM_STATUSES = ["CLEAN", "DIRTY", "OCCUPIED", "OUT_OF_ORDER"] as const;

// `code` maps to a key under messages.formErrors — pages translate it, so
// error text is never hardcoded English on the wire.
function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function createRoomType(formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const parsed = roomTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError("/rooms/new", "validation");
  }
  const data = parsed.data;

  const roomType = await prisma.roomType.create({
    data: {
      hotelId: user.hotelId,
      name: data.name,
      description: data.description || null,
      maxAdults: data.maxAdults,
      maxChildren: data.maxChildren,
      basePrice: data.basePrice,
      photos: data.photoUrl ? [data.photoUrl] : [],
    },
  });

  revalidatePath("/rooms");
  redirect(`/rooms/${roomType.id}`);
}

export async function updateRoomType(roomTypeId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const parsed = roomTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError(`/rooms/${roomTypeId}`, "validation");
  }
  const data = parsed.data;

  await prisma.roomType.updateMany({
    where: { id: roomTypeId, hotelId: user.hotelId },
    data: {
      name: data.name,
      description: data.description || null,
      maxAdults: data.maxAdults,
      maxChildren: data.maxChildren,
      basePrice: data.basePrice,
      photos: data.photoUrl ? [data.photoUrl] : [],
    },
  });

  revalidatePath("/rooms");
  revalidatePath(`/rooms/${roomTypeId}`);
  redirect(`/rooms/${roomTypeId}`);
}

export async function archiveRoomType(roomTypeId: string) {
  const user = await requireApiRole("OWNER", "MANAGER");
  await prisma.roomType.updateMany({
    where: { id: roomTypeId, hotelId: user.hotelId },
    data: { isActive: false },
  });
  revalidatePath("/rooms");
  redirect("/rooms");
}

export async function createRoom(roomTypeId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const parsed = roomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError(`/rooms/${roomTypeId}`, "validation");
  }
  const data = parsed.data;

  // roomTypeId is a bound Server Action argument, i.e. reachable as a raw
  // HTTP call — must confirm it's actually this hotel's before attaching a
  // room to it, or a caller from another tenant could plant a room on it.
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId: user.hotelId },
    select: { id: true },
  });
  if (!roomType) {
    withError("/rooms", "validation");
  }

  try {
    await prisma.room.create({
      data: {
        hotelId: user.hotelId,
        roomTypeId,
        roomNumber: data.roomNumber,
        floor: data.floor || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      withError(`/rooms/${roomTypeId}`, "duplicateRoomNumber");
    }
    throw error;
  }

  revalidatePath(`/rooms/${roomTypeId}`);
  revalidatePath("/rooms");
}

export async function archiveRoom(roomTypeId: string, roomId: string) {
  const user = await requireApiRole("OWNER", "MANAGER");

  const activeBooking = await prisma.bookingRoom.findFirst({
    where: {
      roomId,
      hotelId: user.hotelId,
      booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    },
  });
  if (activeBooking) {
    withError(`/rooms/${roomTypeId}`, "activeBooking");
  }

  await prisma.room.updateMany({
    where: { id: roomId, hotelId: user.hotelId },
    data: { isActive: false },
  });

  revalidatePath(`/rooms/${roomTypeId}`);
  revalidatePath("/rooms");
}

export async function setRoomStatus(roomTypeId: string, roomId: string, formData: FormData) {
  const user = await requireApiSession(); // any staff role may update room status
  const status = formData.get("status");
  if (typeof status !== "string" || !ROOM_STATUSES.includes(status as (typeof ROOM_STATUSES)[number])) {
    withError(`/rooms/${roomTypeId}`, "invalidStatus");
  }

  await prisma.room.updateMany({
    where: { id: roomId, hotelId: user.hotelId },
    data: { status: status as (typeof ROOM_STATUSES)[number] },
  });

  revalidatePath(`/rooms/${roomTypeId}`);
  revalidatePath("/rooms");
}
