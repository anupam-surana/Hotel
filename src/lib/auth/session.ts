import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";

// Cached per-request so multiple Server Components/DAL calls in one render
// share a single decode of the session JWT.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  return session?.user ?? null;
});

// Use in Server Components / layouts / pages that require a signed-in user.
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// Use in Server Components that require one of a set of roles.
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

// Use in Server Actions / Route Handlers, which must never redirect and
// must independently re-verify auth rather than trusting UI-level hiding.
export async function requireApiSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireApiRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireApiSession();
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
