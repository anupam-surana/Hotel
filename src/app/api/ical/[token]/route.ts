import { prisma } from "@/lib/prisma";
import { computeBlockedRanges } from "@/lib/channels/export";
import { iCalAdapter } from "@/lib/channels/ical-adapter";

// Public by design: the token in the URL is the credential (same model as
// most calendar-export links), so OTA calendar clients can fetch it with no
// session. Exposes availability only — blocked date ranges, no guest names,
// no rates, no booking details.
export async function GET(_request: Request, context: RouteContext<"/api/ical/[token]">) {
  const { token } = await context.params;

  const connection = await prisma.channelConnection.findUnique({
    where: { icalExportToken: token },
    include: { roomType: true, hotel: true },
  });

  if (!connection || !connection.isActive || !connection.roomType.isActive || !connection.hotel.isActive) {
    return new Response("Not found", { status: 404 });
  }

  const blockedRanges = await computeBlockedRanges(connection.hotelId, connection.roomTypeId);
  const ics = iCalAdapter.export({
    calendarName: `${connection.hotel.name} — ${connection.roomType.name}`,
    blockedRanges,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${connection.roomType.name.replace(/[^a-z0-9]+/gi, "-")}.ics"`,
    },
  });
}
