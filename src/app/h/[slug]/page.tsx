import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { getAvailability, type AvailabilityQuote } from "@/lib/availability";
import { parseDateKey } from "@/lib/dates";
import { PublicHeader } from "@/components/public-header";

export default async function HotelLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const { slug } = await params;
  const { checkIn: checkInStr, checkOut: checkOutStr } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true } });
  if (!hotel) {
    notFound();
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: hotel.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const datesLookValid =
    !!checkInStr && !!checkOutStr && /^\d{4}-\d{2}-\d{2}$/.test(checkInStr) && /^\d{4}-\d{2}-\d{2}$/.test(checkOutStr);
  const checkIn = datesLookValid ? parseDateKey(checkInStr!) : null;
  const checkOut = datesLookValid ? parseDateKey(checkOutStr!) : null;
  const datesValid = !!checkIn && !!checkOut && checkOut > checkIn;

  const quotesByRoomType = new Map<string, AvailabilityQuote | null>();
  if (datesValid) {
    const quotes = await Promise.all(roomTypes.map((rt) => getAvailability(hotel.id, rt.id, checkIn!, checkOut!)));
    roomTypes.forEach((rt, i) => quotesByRoomType.set(rt.id, quotes[i]));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader hotelName={hotel.name} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold">{hotel.name}</h1>
          {(hotel.address || hotel.city) && (
            <p className="text-sm text-ink/60 dark:text-sand/60">
              {[hotel.address, hotel.city, hotel.state].filter(Boolean).join(", ")}
            </p>
          )}
          {hotel.description && (
            <p className="mt-2 text-sm text-ink/70 dark:text-sand/70">{hotel.description}</p>
          )}
        </div>

        <form
          method="get"
          className="mb-6 flex flex-col gap-2 rounded-2xl border border-ink/10 p-4 dark:border-sand/10"
        >
          <p className="text-sm font-semibold">{t("public.checkAvailability")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="checkIn" className="text-xs font-medium">
                {t("bookings.checkIn")}
              </label>
              <input
                type="date"
                id="checkIn"
                name="checkIn"
                defaultValue={checkInStr ?? ""}
                required
                className="rounded-xl border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="checkOut" className="text-xs font-medium">
                {t("bookings.checkOut")}
              </label>
              <input
                type="date"
                id="checkOut"
                name="checkOut"
                defaultValue={checkOutStr ?? ""}
                required
                className="rounded-xl border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            {t("public.checkAvailability")}
          </button>
        </form>

        {roomTypes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/60 dark:border-sand/20 dark:text-sand/60">
            {t("public.noRoomTypes")}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {roomTypes.map((rt) => {
            const quote = datesValid ? quotesByRoomType.get(rt.id) : null;
            const canBook = datesValid && !!quote && quote.available > 0;
            const photo = rt.photos[0];
            const nightlyPrice = quote ? quote.pricePerRoom.dividedBy(quote.nights) : rt.basePrice;

            return (
              <div
                key={rt.id}
                className="overflow-hidden rounded-2xl border border-ink/10 dark:border-sand/10"
              >
                {photo ? (
                  <div className="relative h-40 w-full bg-ink/5 dark:bg-sand/10">
                    <Image src={photo} alt={rt.name} fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-ink/5 text-3xl font-semibold text-ink/30 dark:bg-sand/10 dark:text-sand/30">
                    {rt.name[0]}
                  </div>
                )}
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{rt.name}</p>
                      <p className="text-sm text-ink/60 dark:text-sand/60">
                        {t("rooms.capacity", { adults: rt.maxAdults, children: rt.maxChildren })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(nightlyPrice.toString(), locale)}</p>
                      <p className="text-xs text-ink/50 dark:text-sand/50">{t("rooms.perNight")}</p>
                    </div>
                  </div>

                  {rt.description && (
                    <p className="text-sm text-ink/70 dark:text-sand/70">{rt.description}</p>
                  )}

                  {rt.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rt.amenities.map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-ink/15 px-2.5 py-1 text-xs dark:border-sand/20"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {!datesValid && (
                    <p className="text-center text-sm text-ink/50 dark:text-sand/50">
                      {t("public.selectDatesHint")}
                    </p>
                  )}
                  {datesValid && !canBook && (
                    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {t("public.soldOut")}
                    </p>
                  )}
                  {canBook && (
                    <Link
                      href={`/h/${slug}/book?roomTypeId=${rt.id}&checkIn=${checkInStr}&checkOut=${checkOutStr}`}
                      className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
                    >
                      {t("public.bookNow")} · {t("public.roomsLeft", { count: quote!.available })}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href={`/h/${slug}/my-booking`} className="font-medium underline">
            {t("public.findMyBooking")}
          </Link>
        </p>
      </main>
    </div>
  );
}
