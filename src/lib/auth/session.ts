import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/subscription";
import type { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";

// Cached per-request so multiple Server Components/DAL calls in one render
// share a single decode of the session JWT.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  return session?.user ?? null;
});

// One extra DB round-trip per request (cached, so repeated calls in one
// render share it) — re-verifies the JWT-cached role/active flags against
// the DB. Without this, deactivating a staff member, demoting a role, or
// deactivating a hotel would have no effect on an already-issued session
// until it naturally expires (NextAuth's default 30-day JWT never gets
// re-checked against the DB on its own).
const getFreshUserState = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, hotel: { select: { isActive: true } } },
  });
});

// Use in Server Components / layouts / pages that require a signed-in user.
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }

  const fresh = await getFreshUserState(user.id);
  if (!fresh || !fresh.isActive || !fresh.hotel.isActive) {
    // Not a plain redirect("/login") — proxy.ts's cookie-only check still
    // sees this JWT as "logged in" and would bounce straight back out of
    // /login, looping forever. This route actually clears the session first.
    redirect("/api/auth/force-logout");
  }

  // Role may have changed since the JWT was issued — always trust the DB.
  return fresh.role === user.role ? user : { ...user, role: fresh.role };
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

  const fresh = await getFreshUserState(user.id);
  if (!fresh || !fresh.isActive || !fresh.hotel.isActive) {
    throw new Error("UNAUTHENTICATED");
  }

  // The locked-screen in (app)/layout.tsx handles the normal UX, but
  // mutating actions are reachable directly (a stale tab, cached JS), so
  // the lock must be re-checked here too — this is the actual enforcement,
  // the layout is just the friendly version of it.
  const subscription = await prisma.platformSubscription.findUnique({ where: { hotelId: user.hotelId } });
  if (isLocked(subscription)) {
    throw new Error("SUBSCRIPTION_LOCKED");
  }

  return fresh.role === user.role ? user : { ...user, role: fresh.role };
}

export async function requireApiRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireApiSession();
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
