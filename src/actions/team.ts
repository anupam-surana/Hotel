"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth/session";
import { sendStaffInviteEmail } from "@/lib/email";

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLES = ["OWNER", "MANAGER", "FRONTDESK", "HOUSEKEEPING"] as const;

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  role: z.enum(ROLES),
});

export async function inviteStaff(formData: FormData) {
  const user = await requireApiRole("OWNER");
  const backPath = "/settings/team";

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError(backPath, "validation");
  }
  const { name, role } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    withError(backPath, "emailTaken");
  }

  // Unusable until they set a real one via /accept-invite — the column is
  // non-nullable, so this can't just be blank.
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const invited = await tx.user.create({
      data: { hotelId: user.hotelId, name, email, passwordHash: placeholderHash, role, emailVerifiedAt: null },
    });
    await tx.verificationToken.create({ data: { userId: invited.id, token, expiresAt } });
  });

  await sendStaffInviteEmail(email, token, { hotelName: user.hotelName, inviterName: user.name, role });

  revalidatePath(backPath);
}

export async function deactivateStaffMember(userId: string) {
  const user = await requireApiRole("OWNER");
  if (userId === user.id) {
    withError("/settings/team", "cannotDeactivateSelf");
  }

  await prisma.user.updateMany({ where: { id: userId, hotelId: user.hotelId }, data: { isActive: false } });
  revalidatePath("/settings/team");
}

export async function reactivateStaffMember(userId: string) {
  const user = await requireApiRole("OWNER");
  await prisma.user.updateMany({ where: { id: userId, hotelId: user.hotelId }, data: { isActive: true } });
  revalidatePath("/settings/team");
}

const acceptSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

// Public — no session exists yet (the invited user hasn't logged in before).
// The token is the credential, same reasoning as email verification / password reset.
export async function acceptInvite(formData: FormData) {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const isPasswordMismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    withError(
      `/accept-invite?token=${(formData.get("token") as string) || ""}`,
      isPasswordMismatch ? "passwordMismatch" : "validation"
    );
  }
  const { token, password } = parsed.data;

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) {
    withError("/login", "inviteLinkInvalid");
  }
  if (record.expiresAt < new Date()) {
    withError("/login", "inviteLinkExpired");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  redirect("/login?inviteAccepted=1");
}
