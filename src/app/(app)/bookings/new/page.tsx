import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/format";
import { createBooking } from "@/actions/bookings";
import { FormErrorBanner } from "@/components/form-error-banner";

const SOURCES = ["WALK_IN", "DIRECT", "BOOKING_COM", "AGODA", "AIRBNB", "MMT"] as const;

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("OWNER", "MANAGER", "FRONTDESK");
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: user.hotelId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("bookings.newTitle")}</h1>
      <FormErrorBanner code={error} />

      {roomTypes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/60 dark:border-sand/20 dark:text-sand/60">
          {t("bookings.noRoomTypesYet")}
        </p>
      ) : (
        <form action={createBooking} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="guestName" className="text-sm font-medium">
              {t("guests.name")}
            </label>
            <input id="guestName" name="guestName" required maxLength={200} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="guestPhone" className="text-sm font-medium">
              {t("guests.phone")}
            </label>
            <input id="guestPhone" name="guestPhone" type="tel" required maxLength={20} className={inputClass} />
            <p className="text-xs text-ink/50 dark:text-sand/50">{t("bookings.phoneMatchHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="guestEmail" className="text-sm font-medium">
              {t("guests.email")}
            </label>
            <input id="guestEmail" name="guestEmail" type="email" maxLength={200} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkIn" className="text-sm font-medium">
                {t("bookings.checkIn")}
              </label>
              <input id="checkIn" name="checkIn" type="date" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkOut" className="text-sm font-medium">
                {t("bookings.checkOut")}
              </label>
              <input id="checkOut" name="checkOut" type="date" required className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="roomTypeId" className="text-sm font-medium">
              {t("bookings.roomType")}
            </label>
            <select id="roomTypeId" name="roomTypeId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                {t("bookings.chooseRoomType")}
              </option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} — {formatCurrency(rt.basePrice.toString(), locale)} {t("rooms.perNight")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quantity" className="text-sm font-medium">
                {t("bookings.quantity")}
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                defaultValue={1}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="adults" className="text-sm font-medium">
                {t("bookings.adults")}
              </label>
              <input
                id="adults"
                name="adults"
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                defaultValue={2}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="children" className="text-sm font-medium">
                {t("bookings.children")}
              </label>
              <input
                id="children"
                name="children"
                type="number"
                inputMode="numeric"
                min={0}
                max={40}
                defaultValue={0}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="source" className="text-sm font-medium">
              {t("bookings.source")}
            </label>
            <select id="source" name="source" defaultValue="WALK_IN" className={inputClass}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`bookingSource.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              {t("common.notes")}
            </label>
            <textarea id="notes" name="notes" rows={2} maxLength={1000} className={inputClass} />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("bookings.create")}
          </button>
        </form>
      )}
    </div>
  );
}
