import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { updateGuest } from "@/actions/guests";
import { FormErrorBanner } from "@/components/form-error-banner";
import { GuestFormFields } from "@/components/guest-form-fields";
import { BookingStatusBadge } from "@/components/booking-status-badge";

export default async function GuestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ guestId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const { guestId } = await params;
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId: user.hotelId },
    include: {
      bookings: {
        orderBy: { checkIn: "desc" },
        select: { id: true, checkIn: true, checkOut: true, status: true, source: true, totalAmount: true },
      },
    },
  });

  if (!guest) {
    notFound();
  }

  const isRepeatGuest = guest.bookings.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{guest.name}</h1>
        {isRepeatGuest && (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
            {t("guests.repeatGuest")}
          </span>
        )}
      </div>

      <FormErrorBanner code={error} />

      <form action={updateGuest.bind(null, guest.id)} className="flex flex-col gap-4">
        <GuestFormFields
          defaultValues={{
            name: guest.name,
            phone: guest.phone ?? "",
            email: guest.email,
            idType: guest.idType,
            idNumber: guest.idNumber,
            address: guest.address,
            notes: guest.notes,
          }}
        />
        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
        >
          {t("common.save")}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("guests.bookingHistory")}</h2>

        {guest.bookings.length === 0 && (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("guests.noBookings")}</p>
        )}

        <div className="flex flex-col gap-2">
          {guest.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
            >
              <div>
                <p className="text-sm font-medium">
                  {formatFullDate(booking.checkIn, locale)} → {formatFullDate(booking.checkOut, locale)}
                </p>
                <p className="text-sm text-ink/60 dark:text-sand/60">
                  {formatCurrency(booking.totalAmount.toString(), locale)}
                </p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
