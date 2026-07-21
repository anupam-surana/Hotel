import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public by design: the token in the URL (emailed to the signer-upper) is
// the credential — no session exists yet at this point (src/auth.ts refuses
// to log in an unverified user), so this must be reachable without one.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const record = token
    ? await prisma.verificationToken.findUnique({ where: { token } })
    : null;

  if (!record) {
    return NextResponse.redirect(new URL("/signup/check-email?error=invalid", request.url));
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/signup/check-email?error=expired", request.url));
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.redirect(new URL("/login?callbackUrl=/onboarding&verified=1", request.url));
}
