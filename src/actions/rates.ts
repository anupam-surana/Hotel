"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { monthKey, parseDateKey } from "@/lib/dates";

const PRICE_RE = /^\d{1,8}(\.\d{1,2})?$/;

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

async function requireOwnedRoomType(hotelId: string, roomTypeId: string) {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId },
    select: { id: true },
  });
  if (!roomType) {
    withError("/rates", "validation");
  }
}

export async function saveRateOverride(roomTypeId: string, dateKeyStr: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  await requireOwnedRoomType(user.hotelId, roomTypeId);

  const editPath = `/rates/${roomTypeId}/${dateKeyStr}`;
  const priceRaw = ((formData.get("price") as string) || "").trim();
  const availableRaw = ((formData.get("availableOverride") as string) || "").trim();
  const closedOut = formData.get("closedOut") === "on";

  let price: string | null = null;
  if (priceRaw) {
    if (!PRICE_RE.test(priceRaw)) {
      withError(editPath, "validation");
    }
    price = priceRaw;
  }

  let availableOverride: number | null = null;
  if (availableRaw) {
    const n = Number(availableRaw);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
      withError(editPath, "validation");
    }
    availableOverride = n;
  }

  const date = parseDateKey(dateKeyStr);

  if (price === null && availableOverride === null && !closedOut) {
    await prisma.rateAvailability.deleteMany({
      where: { hotelId: user.hotelId, roomTypeId, date },
    });
  } else {
    await prisma.rateAvailability.upsert({
      where: { roomTypeId_date: { roomTypeId, date } },
      create: { hotelId: user.hotelId, roomTypeId, date, price, availableOverride, closedOut },
      update: { price, availableOverride, closedOut },
    });
  }

  revalidatePath(`/rates/${roomTypeId}`);
  redirect(`/rates/${roomTypeId}?month=${monthKey(date)}`);
}

export async function clearRateOverride(roomTypeId: string, dateKeyStr: string) {
  const user = await requireApiRole("OWNER", "MANAGER");
  await requireOwnedRoomType(user.hotelId, roomTypeId);

  const date = parseDateKey(dateKeyStr);
  await prisma.rateAvailability.deleteMany({
    where: { hotelId: user.hotelId, roomTypeId, date },
  });

  revalidatePath(`/rates/${roomTypeId}`);
  redirect(`/rates/${roomTypeId}?month=${monthKey(date)}`);
}
