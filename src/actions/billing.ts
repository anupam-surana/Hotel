"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { createCustomer, createSubscription, cancelSubscription, RazorpayError } from "@/lib/razorpay";

function platformCredentials() {
  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID;
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!keyId || !keySecret || !planId) {
    throw new Error("RAZORPAY_PLATFORM_KEY_ID / RAZORPAY_PLATFORM_KEY_SECRET / RAZORPAY_PLAN_ID must be set");
  }
  return { keyId, keySecret, planId };
}

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

// Only creates the Razorpay-side customer/subscription and stores the IDs —
// deliberately does not touch local `status`/`currentPeriodEnd` here. The
// webhook (src/app/api/webhooks/razorpay/route.ts) is the single source of
// truth for subscription state, so the owner stays on whatever screen
// they're on until Razorpay actually confirms the mandate.
export async function startSubscription() {
  const user = await requireApiRole("OWNER");
  const { keyId, keySecret, planId } = platformCredentials();

  const sub = await prisma.platformSubscription.findUnique({ where: { hotelId: user.hotelId } });
  if (!sub) {
    withError("/settings", "validation");
  }

  let customerId = sub.razorpayCustomerId;
  try {
    if (!customerId) {
      customerId = await createCustomer({
        keyId,
        keySecret,
        name: user.hotelName,
        email: user.email,
      });
    }

    const subscription = await createSubscription({
      keyId,
      keySecret,
      planId,
      customerId,
      notes: { hotelId: user.hotelId },
    });

    await prisma.platformSubscription.update({
      where: { hotelId: user.hotelId },
      data: { razorpayCustomerId: customerId, razorpaySubscriptionId: subscription.id },
    });

    redirect(subscription.shortUrl);
  } catch (error) {
    if (error instanceof RazorpayError) {
      withError("/settings", "razorpayError");
    }
    throw error;
  }
}

export async function cancelSubscriptionAction() {
  const user = await requireApiRole("OWNER");
  const { keyId, keySecret } = platformCredentials();

  const sub = await prisma.platformSubscription.findUnique({ where: { hotelId: user.hotelId } });
  if (!sub?.razorpaySubscriptionId) {
    withError("/settings", "validation");
  }

  try {
    await cancelSubscription(keyId, keySecret, sub.razorpaySubscriptionId);
  } catch (error) {
    if (error instanceof RazorpayError) {
      withError("/settings", "razorpayError");
    }
    throw error;
  }

  await prisma.platformSubscription.update({
    where: { hotelId: user.hotelId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/settings");
}
