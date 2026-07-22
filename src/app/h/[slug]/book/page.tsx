import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { getAvailability } from "@/lib/availability";
import { parseDateKey } from "@/lib/dates";
import { createPublicBooking } from "@/actions/public-booking";
import { PublicHeader } from "@/components/public-header";
import { FormErrorBanner } from "@/components/form-error-banner";

export default async function PublicBookingFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ roomTypeId?: string; checkIn?: string; checkOut?: string; quantity?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { roomTypeId, checkIn: checkInStr, checkOut: checkOutStr, quantity: quantityStr, error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true } });
  if (!hotel) {
    notFound();
  }

  const validDates =
    !!roomTypeId &&
    !!checkInStr &&
    !!checkOutStr &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkInStr) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOutStr);
  if (!validDates) {
    notFound();
  }

  const checkIn = parseDateKey(checkInStr!);
  const checkOut = parseDateKey(checkOutStr!);
  if (checkOut <= checkIn) {
    notFound();
  }

  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, hotelId: hotel.id, isActive: true } });
  if (!roomType) {
    notFound();
  }

  const quote = await getAvailability(hotel.id, roomType.id, checkIn, checkOut);
  if (!quote || quote.available <= 0) {
    notFound();
  }

  const defaultQuantity = Math.min(Math.max(Number(quantityStr) || 1, 1), quote.available);
  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader hotelName={hotel.name} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-6 rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
          <p className="font-semibold">{roomType.name}</p>
          <p className="text-sm text-ink/60 dark:text-sand/60">
            {formatFullDate(checkIn, locale)} → {formatFullDate(checkOut, locale)}
          </p>
          <p className="mt-1 text-sm text-ink/60 dark:text-sand/60">
            {t("public.roomsLeft", { count: quote.available })}
          </p>
          <p className="mt-2 font-semibold">
            {formatCurrency(quote.pricePerRoom.toString(), locale)} {t("public.perRoomTotal")}
          </p>
        </div>

        <FormErrorBanner code={error} />

        <form action={createPublicBooking.bind(null, slug)} className="flex flex-col gap-4">
          <input type="hidden" name="roomTypeId" value={roomType.id} />
          <input type="hidden" name="checkIn" value={checkInStr} />
          <input type="hidden" name="checkOut" value={checkOutStr} />

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
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="guestEmail" className="text-sm font-medium">
              {t("guests.email")}
            </label>
            <input id="guestEmail" name="guestEmail" type="email" maxLength={200} className={inputClass} />
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
                max={quote.available}
                defaultValue={defaultQuantity}
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

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("public.confirmBooking")}
          </button>
        </form>
      </main>
    </div>
  );
}
