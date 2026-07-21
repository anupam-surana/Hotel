import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

// Public by design — Razorpay calls this with no session, same reasoning as
// /api/ical/[token] and /api/verify-email. The webhook signature (not a
// session) is the credential here.
//
// This is the single source of truth for PlatformSubscription.status —
// nothing else in the app writes ACTIVE/PAST_DUE/HALTED to that field.
// Always overwrites with Razorpay's reported state, so redelivery of the
// same event is naturally idempotent.

const RAZORPAY_STATUS_MAP: Record<string, SubscriptionStatus | undefined> = {
  authenticated: "ACTIVE",
  active: "ACTIVE",
  pending: "PAST_DUE",
  halted: "HALTED",
  cancelled: "CANCELLED",
  completed: "CANCELLED",
  expired: "EXPIRED",
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !secret || !verifyWebhookSignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const subscriptionEntity = payload?.payload?.subscription?.entity;
  if (!subscriptionEntity?.id) {
    // Not a subscription lifecycle event (e.g. payment.*) — nothing for us to do.
    return new Response("ok", { status: 200 });
  }

  const status = RAZORPAY_STATUS_MAP[subscriptionEntity.status as string];
  if (!status) {
    // e.g. "created" — mandate not yet authorized, no local status change yet.
    return new Response("ok", { status: 200 });
  }

  await prisma.platformSubscription.updateMany({
    where: { razorpaySubscriptionId: subscriptionEntity.id },
    data: {
      status,
      ...(subscriptionEntity.current_end
        ? { currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000) }
        : {}),
    },
  });

  return new Response("ok", { status: 200 });
}
