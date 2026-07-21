import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const user = await requireSession();
  const { bookingId } = await params;
  const locale = await getLocale();
  const t = await getTranslations();

  const invoice = await prisma.invoice.findFirst({
    where: { bookingId, hotelId: user.hotelId },
    include: {
      hotel: true,
      booking: {
        include: { bookingRooms: { include: { roomType: true } } },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const { hotel, booking } = invoice;
  const roomTypeName = booking.bookingRooms[0]?.roomType.name ?? "";
  const quantity = booking.bookingRooms.length;

  return (
    <div className="mx-auto max-w-2xl p-6 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/bookings/${booking.id}`} className="text-sm font-medium text-black/60 dark:text-white/60">
          ← {t("common.back")}
        </Link>
        <PrintButton>{t("invoice.print")}</PrintButton>
      </div>

      <div className="rounded-2xl border border-black/10 p-6 print:border-0 print:p-0 dark:border-white/10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{hotel.name}</h1>
            {(hotel.address || hotel.city) && (
              <p className="text-sm text-black/70 dark:text-white/70">
                {[hotel.address, hotel.city, hotel.state, hotel.pincode].filter(Boolean).join(", ")}
              </p>
            )}
            {hotel.phone && <p className="text-sm text-black/70 dark:text-white/70">{hotel.phone}</p>}
            {hotel.gstin && (
              <p className="text-sm text-black/70 dark:text-white/70">
                {t("invoice.gstin")}: {hotel.gstin}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="font-semibold">{t("invoice.title")}</h2>
            <p className="text-sm text-black/70 dark:text-white/70">{invoice.invoiceNumber}</p>
            <p className="text-sm text-black/70 dark:text-white/70">{formatFullDate(invoice.issueDate, locale)}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">{t("invoice.billTo")}</p>
            <p className="text-black/70 dark:text-white/70">{invoice.guestName}</p>
          </div>
          <div className="text-right">
            <p className="font-medium">{t("invoice.placeOfSupply")}</p>
            <p className="text-black/70 dark:text-white/70">{invoice.placeOfSupply}</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
          <p>
            {formatFullDate(booking.checkIn, locale)} → {formatFullDate(booking.checkOut, locale)}
          </p>
          <p className="text-black/70 dark:text-white/70">
            {roomTypeName}
            {quantity > 1 ? ` × ${quantity}` : ""}
          </p>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1">{t("invoice.taxableAmount")}</td>
              <td className="py-1 text-right">{formatCurrency(invoice.taxableAmount.toString(), locale)}</td>
            </tr>
            <tr>
              <td className="py-1">
                {t("invoice.cgst")} ({invoice.cgstRate.toString()}%)
              </td>
              <td className="py-1 text-right">{formatCurrency(invoice.cgstAmount.toString(), locale)}</td>
            </tr>
            <tr>
              <td className="py-1">
                {t("invoice.sgst")} ({invoice.sgstRate.toString()}%)
              </td>
              <td className="py-1 text-right">{formatCurrency(invoice.sgstAmount.toString(), locale)}</td>
            </tr>
            <tr className="border-t border-black/10 font-bold dark:border-white/10">
              <td className="py-2">{t("invoice.total")}</td>
              <td className="py-2 text-right">{formatCurrency(invoice.totalAmount.toString(), locale)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 text-xs text-black/50 dark:text-white/50">{t("invoice.footerNote")}</p>
      </div>
    </div>
  );
}
