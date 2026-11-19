import { ProxyAgent, setGlobalDispatcher } from "undici";

/**
 * Static-IP egress for Shopify Admin API requests.
 *
 * Shopify's IP allowlist (Dev Dashboard → API access) rejects Admin API
 * requests whose source IP is not allowlisted with a 403. Public App Store
 * apps must comply or risk delisting (Nov 20 2026) and, later, full rejection
 * (Apr 1 2027). See shopify.dev/docs/apps/build/dev-dashboard/ip-allowlist.
 *
 * This app runs on Vercel serverless functions, whose outbound IPs come from a
 * large, shifting pool and cannot be enumerated into a CIDR allowlist. Vercel's
 * native static egress (Secure Compute) is Enterprise-only, which this team is
 * not on. The portable fix is to route all `fetch`-based egress through an
 * external static-IP forward proxy (QuotaGuard Static, Fixie, a self-hosted
 * squid on a host with a dedicated IP, etc.) and allowlist that proxy's IP.
 *
 * The Shopify Node adapter issues Admin API calls via the global `fetch`
 * (undici). Installing a global undici dispatcher transparently routes those
 * calls through the proxy. Database traffic (Prisma → Neon over TCP) does NOT
 * go through `fetch`, so it is unaffected.
 *
 * Off by default: if SHOPIFY_EGRESS_PROXY_URL is unset, nothing changes.
 *
 * Env:
 *   SHOPIFY_EGRESS_PROXY_URL  Proxy URL, e.g. http://user:pass@proxy.host:9293
 */
export function installEgressProxy(): void {
  const proxyUrl = process.env.SHOPIFY_EGRESS_PROXY_URL;
  if (!proxyUrl) return;

  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    // Avoid logging the URL — it may embed proxy credentials.
    console.log("[TieredPricing] Egress proxy enabled for outbound fetch.");
  } catch (err) {
    // Fail loud but don't crash the server: an unreachable/misconfigured proxy
    // should surface in logs, not take the whole app down on boot.
    console.error(
      "[TieredPricing] Failed to install egress proxy from SHOPIFY_EGRESS_PROXY_URL:",
      err,
    );
  }
}
