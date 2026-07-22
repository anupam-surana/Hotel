import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { summarizePayments } from "@/lib/payments";
import { generatePublicPaymentLink } from "@/actions/public-booking";
import { PublicHeader } from "@/components/public-header";
import { FormErrorBanner } from "@/components/form-error-banner";
import { PaymentStatusBadge } from "@/components/payment-status-badge";

export default async function PublicBookingConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, bookingId } = await params;
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true } });
  if (!hotel) {
    notFound();
  }

  const [booking, razorpaySettings] = await Promise.all([
    prisma.booking.findFirst({
      where: { id: bookingId, hotelId: hotel.id },
      include: {
        guest: true,
        bookingRooms: { include: { roomType: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.razorpaySettings.findUnique({ where: { hotelId: hotel.id } }),
  ]);
  if (!booking) {
    notFound();
  }

  const { netPaid, status: paymentStatus } = summarizePayments(booking.payments, booking.totalAmount);
  const balanceDue = booking.totalAmount.minus(netPaid);
  const canPayOnline = !!razorpaySettings?.isActive && booking.status === "CONFIRMED" && balanceDue.greaterThan(0);
  const pendingLink = booking.payments.find((p) => p.method === "RAZORPAY" && p.status === "PENDING");

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader hotelName={hotel.name} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">{t("public.bookingConfirmed")}</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("public.bookingConfirmedHint")}</p>
        </div>

        <FormErrorBanner code={error} />

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{booking.guest.name}</p>
              <p className="text-sm text-ink/60 dark:text-sand/60">
                {booking.bookingRooms[0]?.roomType.name}
                {booking.bookingRooms.length > 1 ? ` × ${booking.bookingRooms.length}` : ""}
              </p>
            </div>
            <PaymentStatusBadge status={paymentStatus} />
          </div>
          <p className="text-sm text-ink/70 dark:text-sand/70">
            {formatFullDate(booking.checkIn, locale)} → {formatFullDate(booking.checkOut, locale)}
          </p>
          <p className="font-semibold">{formatCurrency(booking.totalAmount.toString(), locale)}</p>
        </div>

        {canPayOnline && (
          <form
            action={generatePublicPaymentLink.bind(null, slug, booking.id)}
            className="mb-6 flex flex-col gap-2 rounded-2xl border border-ink/10 p-4 dark:border-sand/10"
          >
            <p className="text-sm font-medium">{t("public.payOnline")}</p>
            <input type="hidden" name="amount" value={balanceDue.toString()} />
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
            >
              {t("public.payNow")} · {formatCurrency(balanceDue.toString(), locale)}
            </button>
          </form>
        )}

        {pendingLink?.razorpayShortUrl && (
          <p className="mb-6 text-center text-sm text-ink/60 dark:text-sand/60">
            <a href={pendingLink.razorpayShortUrl} className="underline">
              {t("public.continuePayment")}
            </a>
          </p>
        )}

        {(hotel.phone || hotel.email) && (
          <div className="mb-6 text-center text-sm text-ink/60 dark:text-sand/60">
            <p>{t("public.questionsContact")}</p>
            {hotel.phone && <p>{hotel.phone}</p>}
            {hotel.email && <p>{hotel.email}</p>}
          </div>
        )}

        <p className="text-center text-sm">
          <Link href={`/h/${slug}/my-booking?bookingId=${booking.id}`} className="font-medium underline">
            {t("public.findMyBooking")}
          </Link>
        </p>
      </main>
    </div>
  );
}
