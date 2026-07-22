import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic, cookie-only auth check (Next.js 16 renamed middleware.ts -> proxy.ts).
// Real authorization (role + hotelId scoping) happens in the DAL (src/lib/auth/session.ts)
// on every Server Component/Server Action/Route Handler — this only keeps signed-out users
// off staff routes and signed-in users off the login page. Never do DB calls here.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup" || pathname.startsWith("/signup/");
  const isAuthUtilityPage =
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/accept-invite";
  const isPublicWhileLoggedOut = isLoginPage || isSignupPage || isAuthUtilityPage;

  if (!isLoggedIn && !isPublicWhileLoggedOut) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicWhileLoggedOut) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Protects everything except public guest-facing routes, all /api/* routes
  // (each one verifies its own auth — see src/lib/auth/session.ts — since
  // some, like the iCal export feed and cron sync, must be reachable by
  // OTA calendar clients and schedulers that never have a session cookie),
  // and static assets.
  matcher: ["/((?!api/|h/|manifest\\.webmanifest|icons/|favicon\\.ico|sw\\.js|_next/static|_next/image).*)"],
};
