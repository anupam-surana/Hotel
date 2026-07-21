"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

// Razorpay credentials are financial and hotel-wide, so only OWNER may
// connect/disconnect — this is a step up from the OWNER/MANAGER/FRONTDESK
// bar used for day-to-day payment recording.
export async function connectRazorpay(formData: FormData) {
  const user = await requireApiRole("OWNER");

  const keyId = ((formData.get("keyId") as string) || "").trim();
  const keySecret = ((formData.get("keySecret") as string) || "").trim();
  if (!keyId || !keySecret) {
    withError("/settings", "validation");
  }

  await prisma.razorpaySettings.upsert({
    where: { hotelId: user.hotelId },
    create: { hotelId: user.hotelId, keyId, keySecret: encryptSecret(keySecret) },
    update: { keyId, keySecret: encryptSecret(keySecret), isActive: true },
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function disconnectRazorpay() {
  const user = await requireApiRole("OWNER");
  await prisma.razorpaySettings.deleteMany({ where: { hotelId: user.hotelId } });
  revalidatePath("/settings");
  redirect("/settings");
}
