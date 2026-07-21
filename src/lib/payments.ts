import { Prisma } from "@/generated/prisma/client";
import type { PaymentStatus, PaymentType } from "@/generated/prisma/enums";

export type BookingPaymentStatus = "PENDING" | "PARTIAL" | "PAID";

// Paid/partial/pending is derived, never stored: it's just PAID payments
// minus PAID refunds, compared against the booking total. Keeping it
// computed avoids a denormalized status field going stale.
export function summarizePayments(
  payments: { type: PaymentType; status: PaymentStatus; amount: Prisma.Decimal | string }[],
  totalAmount: Prisma.Decimal | string
): { netPaid: Prisma.Decimal; status: BookingPaymentStatus } {
  let netPaid = new Prisma.Decimal(0);
  for (const payment of payments) {
    if (payment.status !== "PAID") continue;
    const amount = new Prisma.Decimal(payment.amount.toString());
    netPaid = payment.type === "REFUND" ? netPaid.minus(amount) : netPaid.plus(amount);
  }

  const total = new Prisma.Decimal(totalAmount.toString());
  let status: BookingPaymentStatus = "PENDING";
  if (total.greaterThan(0) && netPaid.greaterThanOrEqualTo(total)) {
    status = "PAID";
  } else if (netPaid.greaterThan(0)) {
    status = "PARTIAL";
  }

  return { netPaid, status };
}
