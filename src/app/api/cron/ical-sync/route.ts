import type { NextRequest } from "next/server";
import { syncAllActiveConnections } from "@/lib/channels/sync";

// Meant to be hit periodically by an external scheduler (cron, Vercel Cron,
// a GitHub Actions schedule, etc.) — every few hours is the spec: iCal sync
// is near-real-time, not instant. Also reachable manually for testing.
// Fails closed: CRON_SECRET must be set and match, no fallback "allow all"
// if it's missing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
  // when a CRON_SECRET env var is set — no need to embed the secret in the
  // committed vercel.json. Query param / X-Cron-Secret stay for any other
  // external scheduler.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const provided =
    bearerToken ?? request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = await syncAllActiveConnections();
  return Response.json({
    synced: results.length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
