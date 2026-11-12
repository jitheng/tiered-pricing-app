import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Unauthenticated liveness/readiness probe for uptime monitoring and alerting.
 *
 * Touches the `Session` table specifically — a bare `SELECT 1` wouldn't catch
 * the missing-table / migration-drift / pooler-visibility condition behind the
 * 2026-11 production incident, which is exactly what we want to alert on.
 *
 * Unlike the old `/test-prisma` route (removed for leaking stack traces), this
 * returns ONLY "ok" / "unhealthy" with no error details — safe to expose.
 */
export const loader = async (_args: LoaderFunctionArgs) => {
  try {
    await prisma.session.count();
    return new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  } catch (err) {
    // Log server-side for debugging; never expose details to the caller.
    console.error("[TieredPricing] Health check failed:", err);
    return new Response("unhealthy", {
      status: 503,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  }
};
