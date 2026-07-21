import { prisma } from "@/lib/prisma";
import { iCalAdapter, IcsFetchError } from "./ical-adapter";

// Pulls one connection's calendar and reconciles our ChannelBlock rows to
// match it exactly: creates new blocks, updates ones whose dates shifted,
// and removes ones the source feed no longer reports (e.g. the guest
// cancelled on the OTA's side). Runs on a schedule (see the cron route) and
// on manual "Sync now" — same function either way.
export async function syncChannelConnection(connectionId: string): Promise<{ ok: boolean; error?: string }> {
  const connection = await prisma.channelConnection.findUnique({ where: { id: connectionId } });
  if (!connection || !connection.icalImportUrl) {
    return { ok: false, error: "No import URL configured." };
  }

  try {
    const ranges = await iCalAdapter.import(connection.icalImportUrl);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.channelBlock.findMany({
        where: { channelConnectionId: connection.id },
        select: { id: true, externalUid: true },
      });
      const existingUids = new Set(existing.map((b) => b.externalUid));
      const incomingUids = new Set(ranges.map((r) => r.uid));

      const staleIds = existing.filter((b) => !incomingUids.has(b.externalUid)).map((b) => b.id);
      if (staleIds.length > 0) {
        await tx.channelBlock.deleteMany({ where: { id: { in: staleIds } } });
      }

      for (const range of ranges) {
        const data = {
          hotelId: connection.hotelId,
          roomTypeId: connection.roomTypeId,
          startDate: range.startDate,
          endDate: range.endDate,
          externalUid: range.uid,
        };
        if (existingUids.has(range.uid)) {
          await tx.channelBlock.update({
            where: {
              channelConnectionId_externalUid: { channelConnectionId: connection.id, externalUid: range.uid },
            },
            data,
          });
        } else {
          await tx.channelBlock.create({ data: { ...data, channelConnectionId: connection.id } });
        }
      }
    });

    await prisma.channelConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSyncStatus: "OK", lastSyncError: null },
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof IcsFetchError ? error.message : "Sync failed unexpectedly.";
    await prisma.channelConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSyncStatus: "ERROR", lastSyncError: message },
    });
    return { ok: false, error: message };
  }
}

// Sequential on purpose: small, polite to OTA endpoints, and avoids
// overlapping writes — connection counts per hotel are expected to be small.
export async function syncAllActiveConnections(): Promise<
  { connectionId: string; ok: boolean; error?: string }[]
> {
  const connections = await prisma.channelConnection.findMany({
    where: { isActive: true, icalImportUrl: { not: null } },
    select: { id: true },
  });

  const results: { connectionId: string; ok: boolean; error?: string }[] = [];
  for (const connection of connections) {
    results.push({ connectionId: connection.id, ...(await syncChannelConnection(connection.id)) });
  }
  return results;
}
