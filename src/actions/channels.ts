"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { syncChannelConnection } from "@/lib/channels/sync";
import type { ChannelType } from "@/generated/prisma/enums";

const CHANNEL_TYPES = ["BOOKING_COM", "AIRBNB", "AGODA", "MMT", "OTHER"] as const;

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function connectChannel(roomTypeId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const backPath = `/rooms/${roomTypeId}`;

  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, hotelId: user.hotelId } });
  if (!roomType) {
    withError("/rooms", "validation");
  }

  const channelRaw = (formData.get("channel") as string) || "";
  if (!(CHANNEL_TYPES as readonly string[]).includes(channelRaw)) {
    withError(backPath, "validation");
  }
  const channel = channelRaw as ChannelType;

  const icalImportUrl = ((formData.get("icalImportUrl") as string) || "").trim();
  if (icalImportUrl && !/^https?:\/\//i.test(icalImportUrl)) {
    withError(backPath, "validation");
  }

  await prisma.channelConnection.upsert({
    where: { roomTypeId_channel: { roomTypeId, channel } },
    create: {
      hotelId: user.hotelId,
      roomTypeId,
      channel,
      icalImportUrl: icalImportUrl || null,
    },
    update: {
      icalImportUrl: icalImportUrl || null,
      isActive: true,
    },
  });

  revalidatePath(backPath);
}

export async function disconnectChannel(roomTypeId: string, connectionId: string) {
  const user = await requireApiRole("OWNER", "MANAGER");
  await prisma.channelConnection.deleteMany({ where: { id: connectionId, hotelId: user.hotelId } });
  revalidatePath(`/rooms/${roomTypeId}`);
}

export async function syncChannelNow(roomTypeId: string, connectionId: string) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const backPath = `/rooms/${roomTypeId}`;

  const connection = await prisma.channelConnection.findFirst({
    where: { id: connectionId, hotelId: user.hotelId },
  });
  if (!connection) {
    withError(backPath, "validation");
  }
  if (!connection.icalImportUrl) {
    withError(backPath, "channelNoImportUrl");
  }

  const result = await syncChannelConnection(connectionId);
  revalidatePath(backPath);

  if (!result.ok) {
    withError(backPath, "channelSyncFailed");
  }
}
