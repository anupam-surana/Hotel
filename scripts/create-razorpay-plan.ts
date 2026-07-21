import "dotenv/config";
import { createPlan } from "../src/lib/razorpay";

// One-time setup: creates the ₹999/month plan on the PLATFORM's own Razorpay
// account (test mode first, then again with live keys when going live).
// Run with: npx tsx scripts/create-razorpay-plan.ts
// Paste the printed plan id into .env as RAZORPAY_PLAN_ID.
async function main() {
  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID;
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Set RAZORPAY_PLATFORM_KEY_ID and RAZORPAY_PLATFORM_KEY_SECRET in .env first.");
  }

  const planId = await createPlan({
    keyId,
    keySecret,
    name: "Hotel PMS subscription",
    amountRupees: 999,
  });

  console.log("Created Razorpay plan:", planId);
  console.log("Add this to .env as RAZORPAY_PLAN_ID=" + planId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
