import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { summarizePayments } from "@/lib/payments";
import {
  assignRoom,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  markNoShow,
} from "@/actions/bookings";
import { recordPayment, recordRefund, generatePaymentLink, refreshPaymentLinkStatus } from "@/actions/payments";
import { generateInvoice } from "@/actions/invoices";
import { FormErrorBanner } from "@/components/form-error-banner";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { BookingSourceBadge } from "@/components/booking-source-badge";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const MANUAL_PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "UPI", "OTHER"] as const;

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const { bookingId } = await params;
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();
  const canOperate = user.role === "OWNER" || user.role === "MANAGER" || user.role === "FRONTDESK";
  const canRefund = user.role === "OWNER" || user.role === "MANAGER";

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: {
      guest: true,
      bookingRooms: { include: { roomType: true, room: true }, orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      invoice: true,
    },
  });

  if (!booking) {
    notFound();
  }

  const razorpaySettings = await prisma.razorpaySettings.findUnique({ where: { hotelId: user.hotelId } });
  const { netPaid, status: paymentStatus } = summarizePayments(booking.payments, booking.totalAmount);
  const balanceDue = booking.totalAmount.minus(netPaid);
  const tPaymentMethod = await getTranslations("paymentMethod");

  const roomTypeId = booking.bookingRooms[0]?.roomTypeId;
  let availableRooms: { id: string; roomNumber: string }[] = [];
  if (roomTypeId && (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN")) {
    const [allRoomsOfType, conflicts] = await Promise.all([
      prisma.room.findMany({
        where: { hotelId: user.hotelId, roomTypeId, isActive: true },
        orderBy: { roomNumber: "asc" },
        select: { id: true, roomNumber: true },
      }),
      prisma.bookingRoom.findMany({
        where: {
          hotelId: user.hotelId,
          roomTypeId,
          roomId: { not: null },
          bookingId: { not: booking.id },
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: booking.checkIn },
          booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        },
        select: { roomId: true },
      }),
    ]);
    const conflictingRoomIds = new Set(conflicts.map((c) => c.roomId));
    availableRooms = allRoomsOfType.filter((r) => !conflictingRoomIds.has(r.id));
  }

  const allAssigned = booking.bookingRooms.every((br) => !!br.roomId);

  return (
    <div className="flex flex-col gap-6">
      <FormErrorBanner code={error} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            <Link href={`/guests/${booking.guest.id}`} className="underline">
              {booking.guest.name}
            </Link>
          </h1>
          <p className="text-sm text-ink/60 dark:text-sand/60">{booking.guest.phone}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <BookingStatusBadge status={booking.status} />
          <BookingSourceBadge source={booking.source} />
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 p-4 dark:border-sand/10">
        <p className="font-medium">
          {formatFullDate(booking.checkIn, locale)} → {formatFullDate(booking.checkOut, locale)}
        </p>
        <p className="text-sm text-ink/60 dark:text-sand/60">
          {t("bookings.adultsChildren", { adults: booking.adults, children: booking.children })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="font-semibold">{formatCurrency(booking.totalAmount.toString(), locale)}</p>
          <PaymentStatusBadge status={paymentStatus} />
        </div>
      </div>

      {booking.notes && (
        <div>
          <h2 className="text-sm font-semibold">{t("common.notes")}</h2>
          <p className="text-sm text-ink/70 dark:text-sand/70">{booking.notes}</p>
        </div>
      )}

      {booking.status === "CANCELLED" && booking.cancellationReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {t("bookings.cancellationReasonLabel")}: {booking.cancellationReason}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("bookings.rooms")}</h2>
        <div className="flex flex-col gap-2">
          {booking.bookingRooms.map((br) => (
            <div
              key={br.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
            >
              <div>
                <p className="text-sm font-medium">{br.roomType.name}</p>
                <p className="text-xs text-ink/50 dark:text-sand/50">
                  {formatCurrency(br.amount.toString(), locale)}
                </p>
              </div>

              {canOperate && (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") ? (
                <form action={assignRoom.bind(null, br.id)}>
                  <AutoSubmitSelect
                    name="roomId"
                    defaultValue={br.roomId ?? ""}
                    options={[
                      { value: "", label: t("bookings.unassigned") },
                      ...availableRooms.map((r) => ({ value: r.id, label: r.roomNumber })),
                    ]}
                    className="rounded-full border border-ink/15 bg-transparent px-3 py-1.5 text-xs font-medium dark:border-sand/20"
                  />
                </form>
              ) : (
                <span className="text-sm font-medium">{br.room?.roomNumber ?? t("bookings.unassigned")}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("payments.title")}</h2>

        {booking.payments.length === 0 && (
          <p className="text-sm text-ink/60 dark:text-sand/60">{t("payments.noPayments")}</p>
        )}

        <div className="flex flex-col gap-2">
          {booking.payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {payment.type === "REFUND" ? "− " : ""}
                    {formatCurrency(payment.amount.toString(), locale)}
                  </p>
                  <p className="text-xs text-ink/50 dark:text-sand/50">
                    {tPaymentMethod(payment.method)} · {formatFullDate(payment.createdAt, locale)}
                  </p>
                  {payment.notes && (
                    <p className="mt-1 text-xs text-ink/70 dark:text-sand/70">{payment.notes}</p>
                  )}
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
                    (payment.status === "PAID"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : payment.status === "PENDING"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300")
                  }
                >
                  {t(`paymentEntryStatus.${payment.status}`)}
                </span>
              </div>

              {payment.method === "RAZORPAY" && payment.status === "PENDING" && (
                <div className="flex items-center justify-between gap-2">
                  {payment.razorpayShortUrl && (
                    <a
                      href={payment.razorpayShortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs underline"
                    >
                      {payment.razorpayShortUrl}
                    </a>
                  )}
                  {canOperate && (
                    <form action={refreshPaymentLinkStatus.bind(null, booking.id, payment.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium dark:border-sand/20"
                      >
                        {t("payments.checkStatus")}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {canOperate && (
          <>
            <form
              action={recordPayment.bind(null, booking.id)}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-ink/15 p-3 dark:border-sand/20"
            >
              <p className="text-sm font-medium">{t("payments.recordPayment")}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  defaultValue={balanceDue.greaterThan(0) ? balanceDue.toString() : undefined}
                  required
                  placeholder={t("payments.amount")}
                  className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                />
                <select
                  name="method"
                  required
                  className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                >
                  {MANUAL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {tPaymentMethod(m)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                name="notes"
                placeholder={t("payments.notesPlaceholder")}
                className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {t("payments.recordPayment")}
              </button>
            </form>

            {razorpaySettings && (
              <form
                action={generatePaymentLink.bind(null, booking.id)}
                className="flex flex-col gap-2 rounded-xl border border-dashed border-ink/15 p-3 dark:border-sand/20"
              >
                <p className="text-sm font-medium">{t("payments.generateLink")}</p>
                <input
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  defaultValue={balanceDue.greaterThan(0) ? balanceDue.toString() : undefined}
                  required
                  placeholder={t("payments.amount")}
                  className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm font-semibold dark:border-sand/20"
                >
                  {t("payments.generateLink")}
                </button>
              </form>
            )}

            {canRefund && netPaid.greaterThan(0) && (
              <form
                action={recordRefund.bind(null, booking.id)}
                className="flex flex-col gap-2 rounded-xl border border-dashed border-red-300 p-3 dark:border-red-500/30"
              >
                <p className="text-sm font-medium">{t("payments.recordRefund")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    required
                    placeholder={t("payments.amount")}
                    className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                  />
                  <select
                    name="method"
                    required
                    className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                  >
                    {MANUAL_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {tPaymentMethod(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  name="notes"
                  placeholder={t("payments.notesPlaceholder")}
                  className="rounded-lg border border-ink/15 px-3 py-2.5 text-sm dark:border-sand/20 dark:bg-sand/5"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-3 py-2.5 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
                >
                  {t("payments.recordRefund")}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {canOperate && booking.status === "CONFIRMED" && (
        <div className="flex flex-col gap-3">
          {!allAssigned && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{t("bookings.assignAllHint")}</p>
          )}
          <form action={checkInBooking.bind(null, booking.id)}>
            <button
              type="submit"
              disabled={!allAssigned}
              className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-40"
            >
              {t("bookings.checkInAction")}
            </button>
          </form>

          <form action={markNoShow.bind(null, booking.id)}>
            <ConfirmSubmitButton
              confirmMessage={t("bookings.noShowConfirm")}
              className="w-full rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-500/40 dark:text-amber-400"
            >
              {t("bookings.markNoShow")}
            </ConfirmSubmitButton>
          </form>

          <form action={cancelBooking.bind(null, booking.id)} className="flex flex-col gap-2">
            <textarea
              name="reason"
              rows={2}
              maxLength={500}
              placeholder={t("bookings.cancellationReasonPlaceholder")}
              className="w-full rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5"
            />
            <ConfirmSubmitButton
              confirmMessage={t("bookings.cancelConfirm")}
              className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
            >
              {t("bookings.cancelAction")}
            </ConfirmSubmitButton>
          </form>
        </div>
      )}

      {canOperate && booking.status === "CHECKED_IN" && (
        <form action={checkOutBooking.bind(null, booking.id)}>
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("bookings.checkOutAction")}
          </button>
        </form>
      )}

      {booking.status === "CHECKED_OUT" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("invoice.title")}</h2>
          {booking.invoice ? (
            <Link
              href={`/invoices/${booking.id}`}
              className="rounded-xl border border-ink/15 px-4 py-3.5 text-center text-sm font-semibold dark:border-sand/20"
            >
              {t("invoice.view")} ({booking.invoice.invoiceNumber})
            </Link>
          ) : (
            canOperate && (
              <form action={generateInvoice.bind(null, booking.id)}>
                <button
                  type="submit"
                  className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-sm font-semibold dark:border-sand/20"
                >
                  {t("invoice.generate")}
                </button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}
