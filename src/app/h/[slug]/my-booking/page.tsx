import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { summarizePayments } from "@/lib/payments";
import { requestGuestCancellation } from "@/actions/guest-lookup";
import { PublicHeader } from "@/components/public-header";
import { FormErrorBanner } from "@/components/form-error-banner";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { PaymentStatusBadge } from "@/components/payment-status-badge";

export default async function MyBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bookingId?: string; phone?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { bookingId, phone, error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true } });
  if (!hotel) {
    notFound();
  }

  const attemptedLookup = !!bookingId && !!phone;
  const booking = attemptedLookup
    ? await prisma.booking.findFirst({
        where: { id: bookingId, hotelId: hotel.id, guest: { phone } },
        include: { guest: true, bookingRooms: { include: { roomType: true } }, payments: true },
      })
    : null;

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader hotelName={hotel.name} />
      <main className="flex-1 px-4 py-4">
        <h1 className="mb-4 text-xl font-bold">{t("public.myBookingTitle")}</h1>

        <div className="mb-4">
          <FormErrorBanner code={error} />
        </div>

        {!booking && (
          <form method="GET" className="mb-6 flex flex-col gap-3 rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bookingId" className="text-sm font-medium">
                {t("public.bookingReference")}
              </label>
              <input id="bookingId" name="bookingId" required defaultValue={bookingId} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                {t("public.lookupPhone")}
              </label>
              <input id="phone" name="phone" required defaultValue={phone} className={inputClass} />
            </div>
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
            >
              {t("public.lookupCta")}
            </button>
          </form>
        )}

        {attemptedLookup && !booking && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t("public.lookupNotFound")}
          </p>
        )}

        {booking && (
          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{booking.guest.name}</p>
                <p className="text-sm text-ink/60 dark:text-sand/60">
                  {booking.bookingRooms[0]?.roomType.name}
                  {booking.bookingRooms.length > 1 ? ` × ${booking.bookingRooms.length}` : ""}
                </p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-ink/70 dark:text-sand/70">
              {formatFullDate(booking.checkIn, locale)} → {formatFullDate(booking.checkOut, locale)}
            </p>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{formatCurrency(booking.totalAmount.toString(), locale)}</p>
              <PaymentStatusBadge status={summarizePayments(booking.payments, booking.totalAmount).status} />
            </div>

            {booking.status === "CONFIRMED" && (
              <form action={requestGuestCancellation.bind(null, slug, booking.id)}>
                <input type="hidden" name="phone" value={phone} />
                <ConfirmSubmitButton
                  confirmMessage={t("public.cancelConfirm")}
                  className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
                >
                  {t("public.requestCancellation")}
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
