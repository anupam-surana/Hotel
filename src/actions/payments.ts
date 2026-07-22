"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { createPaymentLink, fetchPaymentLinkStatus, RazorpayError } from "@/lib/razorpay";
import { summarizePayments } from "@/lib/payments";
import type { PaymentMethod } from "@/generated/prisma/enums";

// RAZORPAY is handled by its own generatePaymentLink flow, not manual entry.
const MANUAL_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "UPI", "OTHER"] as const;
const AMOUNT_RE = /^\d{1,8}(\.\d{1,2})?$/;

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

function readAmount(formData: FormData, backPath: string): string {
  const raw = ((formData.get("amount") as string) || "").trim();
  if (!AMOUNT_RE.test(raw) || Number(raw) <= 0) {
    withError(backPath, "validation");
  }
  return raw;
}

function readManualMethod(formData: FormData, backPath: string): PaymentMethod {
  const raw = (formData.get("method") as string) || "";
  if (!(MANUAL_METHODS as readonly string[]).includes(raw)) {
    withError(backPath, "validation");
  }
  return raw as PaymentMethod;
}

export async function recordPayment(bookingId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");
  const backPath = `/bookings/${bookingId}`;

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId: user.hotelId } });
  if (!booking) {
    withError("/bookings", "validation");
  }

  const amount = readAmount(formData, backPath);
  const method = readManualMethod(formData, backPath);
  const notes = ((formData.get("notes") as string) || "").trim();

  await prisma.payment.create({
    data: {
      hotelId: user.hotelId,
      bookingId,
      type: "PAYMENT",
      method,
      status: "PAID",
      amount,
      notes: notes || null,
      paidAt: new Date(),
      createdById: user.id,
    },
  });

  revalidatePath(backPath);
}

export async function recordRefund(bookingId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER");
  const backPath = `/bookings/${bookingId}`;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: { payments: true },
  });
  if (!booking) {
    withError("/bookings", "validation");
  }

  const amount = readAmount(formData, backPath);
  const method = readManualMethod(formData, backPath);
  const notes = ((formData.get("notes") as string) || "").trim();

  const { netPaid } = summarizePayments(booking.payments, booking.totalAmount);
  if (Number(amount) > Number(netPaid.toString())) {
    withError(backPath, "refundExceedsPaid");
  }

  await prisma.payment.create({
    data: {
      hotelId: user.hotelId,
      bookingId,
      type: "REFUND",
      method,
      status: "PAID",
      amount,
      notes: notes || null,
      paidAt: new Date(),
      createdById: user.id,
    },
  });

  revalidatePath(backPath);
}

export async function generatePaymentLink(bookingId: string, formData: FormData) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");
  const backPath = `/bookings/${bookingId}`;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hotelId: user.hotelId },
    include: { guest: true },
  });
  if (!booking) {
    withError("/bookings", "validation");
  }

  const razorpaySettings = await prisma.razorpaySettings.findUnique({ where: { hotelId: user.hotelId } });
  if (!razorpaySettings || !razorpaySettings.isActive) {
    withError(backPath, "razorpayNotConnected");
  }

  const amount = readAmount(formData, backPath);

  let link;
  try {
    link = await createPaymentLink({
      keyId: razorpaySettings.keyId,
      keySecret: decryptSecret(razorpaySettings.keySecret),
      amountRupees: Number(amount),
      description: `Booking payment — ${booking.guest.name}`,
      referenceId: booking.id,
      customerName: booking.guest.name,
      customerContact: booking.guest.phone ?? undefined,
      customerEmail: booking.guest.email ?? undefined,
    });
  } catch (error) {
    if (error instanceof RazorpayError) {
      withError(backPath, "razorpayError");
    }
    throw error;
  }

  await prisma.payment.create({
    data: {
      hotelId: user.hotelId,
      bookingId,
      type: "PAYMENT",
      method: "RAZORPAY",
      status: "PENDING",
      amount,
      razorpayLinkId: link.id,
      razorpayShortUrl: link.shortUrl,
      createdById: user.id,
    },
  });

  revalidatePath(backPath);
}

export async function refreshPaymentLinkStatus(bookingId: string, paymentId: string) {
  const user = await requireApiRole("OWNER", "MANAGER", "FRONTDESK");
  const backPath = `/bookings/${bookingId}`;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, hotelId: user.hotelId, bookingId },
  });
  if (!payment || !payment.razorpayLinkId) {
    withError(backPath, "validation");
  }

  const razorpaySettings = await prisma.razorpaySettings.findUnique({ where: { hotelId: user.hotelId } });
  if (!razorpaySettings) {
    withError(backPath, "razorpayNotConnected");
  }

  let status: string;
  try {
    status = await fetchPaymentLinkStatus(
      razorpaySettings.keyId,
      decryptSecret(razorpaySettings.keySecret),
      payment.razorpayLinkId
    );
  } catch (error) {
    if (error instanceof RazorpayError) {
      withError(backPath, "razorpayError");
    }
    throw error;
  }

  const newStatus = status === "paid" ? "PAID" : status === "cancelled" || status === "expired" ? "FAILED" : "PENDING";

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: newStatus, paidAt: newStatus === "PAID" ? new Date() : null },
  });

  revalidatePath(backPath);
}
