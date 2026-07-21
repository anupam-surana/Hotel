import { getTranslations } from "next-intl/server";
import type { BookingPaymentStatus } from "@/lib/payments";

const COLORS: Record<BookingPaymentStatus, string> = {
  PENDING: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  PARTIAL: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export async function PaymentStatusBadge({ status }: { status: BookingPaymentStatus }) {
  const t = await getTranslations("paymentStatus");
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COLORS[status]}`}>
      {t(status)}
    </span>
  );
}
