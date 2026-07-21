import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/format";
import { RoomStatusBadge } from "@/components/room-status-badge";

export default async function RoomsPage() {
  const user = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations();
  const canManage = user.role === "OWNER" || user.role === "MANAGER";

  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: user.hotelId, isActive: true },
    include: {
      rooms: { where: { isActive: true }, orderBy: { roomNumber: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("rooms.title")}</h1>
        {canManage && (
          <Link
            href="/rooms/new"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {t("rooms.addRoomType")}
          </Link>
        )}
      </div>

      {roomTypes.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
          {t("rooms.noRoomTypes")}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {roomTypes.map((roomType) => (
          <Link
            key={roomType.id}
            href={`/rooms/${roomType.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{roomType.name}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {t("rooms.capacity", {
                    adults: roomType.maxAdults,
                    children: roomType.maxChildren,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(roomType.basePrice.toString(), locale)}</p>
                <p className="text-xs text-black/50 dark:text-white/50">{t("rooms.perNight")}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-black/50 dark:text-white/50">
                {t("rooms.roomsCount", { count: roomType.rooms.length })}
              </span>
              {roomType.rooms.map((room) => (
                <span key={room.id} className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-medium">{room.roomNumber}</span>
                  <RoomStatusBadge status={room.status} />
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
