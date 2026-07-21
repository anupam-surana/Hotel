import type { PlatformSubscription } from "@/generated/prisma/client";

// Locked statuses stop the hotel from using the app at all (except the
// billing CTA on the locked screen itself). TRIALING only locks once its
// currentPeriodEnd (the trial end date) has passed — computed live, no cron
// needed to flip the status.
export function isLocked(sub: PlatformSubscription | null): boolean {
  if (!sub) return false; // no row (shouldn't happen post-migration) — fail open, not closed
  if (sub.status === "HALTED" || sub.status === "CANCELLED" || sub.status === "EXPIRED") {
    return true;
  }
  if (sub.status === "TRIALING" && sub.currentPeriodEnd < new Date()) {
    return true;
  }
  return false;
}

// PAST_DUE means Razorpay is auto-retrying a failed charge — still usable,
// just needs a visible nudge to fix the payment method before it's HALTED.
export function showsPastDueBanner(sub: PlatformSubscription | null): boolean {
  return sub?.status === "PAST_DUE";
}
