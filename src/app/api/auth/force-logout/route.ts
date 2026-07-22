import { signOut } from "@/auth";

// Used by src/lib/auth/session.ts when a session's JWT is stale (the user
// was deactivated, or their hotel was, after the JWT was issued) — a plain
// redirect("/login") would bounce right back here, since proxy.ts's
// cookie-only check still sees a "logged in" JWT and redirects away from
// /login. Actually clearing the session (not just redirecting) breaks the
// loop. /api/* is already excluded from proxy.ts's matcher.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
