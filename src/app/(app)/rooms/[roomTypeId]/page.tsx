import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import {
  archiveRoom,
  archiveRoomType,
  createRoom,
  setRoomStatus,
  updateRoomType,
} from "@/actions/rooms";
import { connectChannel, disconnectChannel, syncChannelNow } from "@/actions/channels";
import { FormErrorBanner } from "@/components/form-error-banner";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const ROOM_STATUS_OPTIONS = ["CLEAN", "DIRTY", "OCCUPIED", "OUT_OF_ORDER"] as const;
const CHANNEL_TYPES = ["BOOKING_COM", "AIRBNB", "AGODA", "MMT", "OTHER"] as const;

export default async function RoomTypeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const { roomTypeId } = await params;
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();
  const tRoomStatus = await getTranslations("roomStatus");
  const tChannelType = await getTranslations("channelType");
  const canManage = user.role === "OWNER" || user.role === "MANAGER";

  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId: user.hotelId, isActive: true },
    include: {
      rooms: { where: { isActive: true }, orderBy: { roomNumber: "asc" } },
      channelConnections: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!roomType) {
    notFound();
  }

  const statusOptions = ROOM_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: tRoomStatus(status),
  }));

  const connectedChannels = new Set(roomType.channelConnections.map((c) => c.channel));
  const availableChannelsToAdd = CHANNEL_TYPES.filter((c) => !connectedChannels.has(c));

  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;

  return (
    <div className="flex flex-col gap-6">
      <FormErrorBanner code={error} />

      {canManage ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-bold">{t("roomType.editTitle")}</h1>
          <form action={updateRoomType.bind(null, roomType.id)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                {t("roomType.name")}
              </label>
              <input
                id="name"
                name="name"
                required
                maxLength={100}
                defaultValue={roomType.name}
                className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                {t("roomType.description")}
              </label>
              <textarea
                id="description"
                name="description"
                maxLength={1000}
                rows={3}
                defaultValue={roomType.description ?? ""}
                className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="maxAdults" className="text-sm font-medium">
                  {t("roomType.maxAdults")}
                </label>
                <input
                  id="maxAdults"
                  name="maxAdults"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  required
                  defaultValue={roomType.maxAdults}
                  className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="maxChildren" className="text-sm font-medium">
                  {t("roomType.maxChildren")}
                </label>
                <input
                  id="maxChildren"
                  name="maxChildren"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  required
                  defaultValue={roomType.maxChildren}
                  className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="basePrice" className="text-sm font-medium">
                {t("roomType.basePrice")}
              </label>
              <input
                id="basePrice"
                name="basePrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required
                defaultValue={roomType.basePrice.toString()}
                className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="photoUrl" className="text-sm font-medium">
                {t("roomType.photoUrl")}
              </label>
              <input
                id="photoUrl"
                name="photoUrl"
                type="url"
                maxLength={2000}
                defaultValue={roomType.photos[0] ?? ""}
                placeholder={t("roomType.photoUrlPlaceholder")}
                className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
              />
              <p className="text-xs text-ink/50 dark:text-sand/50">{t("roomType.photoUrlHint")}</p>
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
            >
              {t("roomType.saveChanges")}
            </button>
          </form>

          <form action={archiveRoomType.bind(null, roomType.id)}>
            <ConfirmSubmitButton
              confirmMessage={t("roomType.deactivateConfirm")}
              className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
            >
              {t("roomType.deactivate")}
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-bold">{roomType.name}</h1>
          <p className="text-sm text-ink/60 dark:text-sand/60">
            {t("rooms.capacity", { adults: roomType.maxAdults, children: roomType.maxChildren })} ·{" "}
            {formatCurrency(roomType.basePrice.toString(), locale)} {t("rooms.perNight")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("roomType.roomsHeading")}</h2>

        {roomType.rooms.length === 0 && (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("room.noRooms")}</p>
        )}

        <div className="flex flex-col gap-2">
          {roomType.rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
            >
              <div>
                <p className="font-medium">{room.roomNumber}</p>
                {room.floor && (
                  <p className="text-xs text-ink/50 dark:text-sand/50">{room.floor}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Any staff role may change room status (front desk / housekeeping
                    need this before the dedicated Housekeeping module exists). */}
                <form action={setRoomStatus.bind(null, roomType.id, room.id)}>
                  <AutoSubmitSelect
                    name="status"
                    defaultValue={room.status}
                    options={statusOptions}
                    className="rounded-full border border-ink/15 bg-transparent px-3 py-1.5 text-xs font-medium dark:border-sand/20"
                  />
                </form>

                {canManage && (
                  <form action={archiveRoom.bind(null, roomType.id, room.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={t("room.deactivateConfirm")}
                      className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-500/40 dark:text-red-400"
                    >
                      {t("room.deactivate")}
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <form
            action={createRoom.bind(null, roomType.id)}
            className="flex items-end gap-2 rounded-xl border border-dashed border-ink/15 p-3 dark:border-sand/20"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="roomNumber" className="text-xs font-medium">
                {t("room.roomNumber")}
              </label>
              <input
                id="roomNumber"
                name="roomNumber"
                required
                maxLength={20}
                placeholder={t("room.roomNumberPlaceholder")}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="floor" className="text-xs font-medium">
                {t("room.floor")}
              </label>
              <input
                id="floor"
                name="floor"
                maxLength={20}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {t("room.addRoom")}
            </button>
          </form>
        )}
      </div>

      {canManage && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("channels.title")}</h2>
          <p className="text-xs text-ink/50 dark:text-sand/50">{t("channels.disclaimer")}</p>

          <div className="flex flex-col gap-2">
            {roomType.channelConnections.map((connection) => (
              <div
                key={connection.id}
                className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{tChannelType(connection.channel)}</p>
                  <span
                    data-testid="channel-sync-status"
                    className={
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
                      (connection.lastSyncStatus === "ERROR"
                        ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                        : connection.lastSyncedAt
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-ink/5 text-ink/60 dark:bg-sand/10 dark:text-sand/60")
                    }
                  >
                    {connection.lastSyncStatus === "ERROR"
                      ? t("channels.syncError")
                      : connection.lastSyncedAt
                        ? t("channels.synced")
                        : t("channels.neverSynced")}
                  </span>
                </div>

                {connection.lastSyncedAt && (
                  <p className="text-xs text-ink/50 dark:text-sand/50">
                    {t("channels.lastSynced")}: {formatFullDate(connection.lastSyncedAt, locale)}
                  </p>
                )}
                {connection.lastSyncError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{connection.lastSyncError}</p>
                )}

                {connection.icalImportUrl && (
                  <form action={syncChannelNow.bind(null, roomType.id, connection.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium dark:border-sand/20"
                    >
                      {t("channels.syncNow")}
                    </button>
                  </form>
                )}

                <div>
                  <p className="text-xs font-medium">{t("channels.exportFeedLabel")}</p>
                  <p className="break-all text-xs text-ink/60 dark:text-sand/60">
                    {origin}/api/ical/{connection.icalExportToken}
                  </p>
                </div>

                <form action={disconnectChannel.bind(null, roomType.id, connection.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={t("channels.disconnectConfirm")}
                    className="w-full rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-500/40 dark:text-red-400"
                  >
                    {t("channels.disconnect")}
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>

          {availableChannelsToAdd.length > 0 && (
            <form
              action={connectChannel.bind(null, roomType.id)}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-ink/15 p-3 dark:border-sand/20"
            >
              <select
                name="channel"
                required
                defaultValue=""
                className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
              >
                <option value="" disabled>
                  {t("channels.chooseChannel")}
                </option>
                {availableChannelsToAdd.map((c) => (
                  <option key={c} value={c}>
                    {tChannelType(c)}
                  </option>
                ))}
              </select>
              <input
                type="url"
                name="icalImportUrl"
                placeholder={t("channels.importUrlPlaceholder")}
                className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {t("channels.connect")}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
