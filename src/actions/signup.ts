"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { slugify, ensureUniqueSlug } from "@/lib/slug";
import { sendVerificationEmail } from "@/lib/email";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;

const signupSchema = z
  .object({
    hotelName: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    address: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    pincode: z.string().trim().max(20).optional().or(z.literal("")),
    gstin: z.string().trim().max(20).optional().or(z.literal("")),
    ownerName: z.string().trim().min(1).max(100),
    ownerEmail: z.string().trim().email().max(200),
    ownerPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.ownerPassword === data.confirmPassword, {
    path: ["confirmPassword"],
  });

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function createHotelAccount(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const isPasswordMismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    withError("/signup", isPasswordMismatch ? "passwordMismatch" : "validation");
  }
  const data = parsed.data;

  const email = data.ownerEmail.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    withError("/signup", "emailTaken");
  }

  const locale = await getLocale();
  const slug = await ensureUniqueSlug(slugify(data.hotelName));
  const passwordHash = await bcrypt.hash(data.ownerPassword, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const hotel = await tx.hotel.create({
      data: {
        slug,
        name: data.hotelName,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        gstin: data.gstin || null,
        defaultLocale: locale,
      },
    });

    const user = await tx.user.create({
      data: {
        hotelId: hotel.id,
        name: data.ownerName,
        email,
        passwordHash,
        role: "OWNER",
        locale,
      },
    });

    await tx.verificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await tx.platformSubscription.create({
      data: {
        hotelId: hotel.id,
        status: "TRIALING",
        currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  });

  await sendVerificationEmail(email, token);

  redirect("/signup/check-email");
}

const resendSchema = z.object({
  email: z.string().trim().email().max(200),
});

export async function resendVerification(formData: FormData) {
  const parsed = resendSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });

    // Silently no-op for unknown/already-verified emails — the confirmation
    // page shows the same message either way, so this never leaks which
    // emails are registered.
    if (user && !user.emailVerifiedAt) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
      await prisma.verificationToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, token, expiresAt },
        update: { token, expiresAt },
      });
      await sendVerificationEmail(email, token);
    }
  }

  redirect("/signup/check-email?resent=1");
}
