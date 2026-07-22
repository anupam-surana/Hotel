"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter-lived than signup verification since this grants immediate account access

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

const requestSchema = z.object({
  email: z.string().trim().email().max(200),
});

export async function requestPasswordReset(formData: FormData) {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    // Silently no-op for unknown emails — the confirmation page shows the
    // same message either way, so this never leaks which emails exist.
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await prisma.passwordResetToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, token, expiresAt },
        update: { token, expiresAt },
      });
      await sendPasswordResetEmail(email, token);
    }
  }

  redirect("/forgot-password?sent=1");
}

const resetSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

export async function resetPassword(formData: FormData) {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const isPasswordMismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    withError(
      `/reset-password?token=${(formData.get("token") as string) || ""}`,
      isPasswordMismatch ? "passwordMismatch" : "validation"
    );
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record) {
    withError("/forgot-password", "resetLinkInvalid");
  }
  if (record.expiresAt < new Date()) {
    withError("/forgot-password", "resetLinkExpired");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  redirect("/login?resetComplete=1");
}
