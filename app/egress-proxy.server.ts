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
 * Shopify Admin API traffic is HTTPS end-to-end via CONNECT tunnelling, so the
 * proxy only ever sees ciphertext and the destination host — it cannot read the
 * access tokens. The only thing exposed on the Vercel→proxy hop is the proxy's
 * own basic-auth credential. Use an `https://` proxy URL to encrypt that hop
 * too: the proxy terminates TLS (stunnel in front of squid) and we pin its
 * self-signed CA via SHOPIFY_EGRESS_PROXY_CA so the `Proxy-Authorization`
 * header never travels in clear.
 *
 * Off by default: if SHOPIFY_EGRESS_PROXY_URL is unset, nothing changes.
 *
 * Env:
 *   SHOPIFY_EGRESS_PROXY_URL  Proxy URL, e.g.
 *     http://user:pass@proxy.host:3128   (plaintext proxy connection), or
 *     https://user:pass@proxy.host:3128  (TLS proxy connection — preferred)
 *   SHOPIFY_EGRESS_PROXY_CA   PEM of the proxy's TLS cert/CA to trust (required
 *     for an https:// proxy using a self-signed cert). Literal "\n" sequences
 *     are normalised to newlines so the PEM can live on one env line.
 */
export function installEgressProxy(): void {
  const proxyUrl = process.env.SHOPIFY_EGRESS_PROXY_URL;
  if (!proxyUrl) return;

  try {
    const isTls = proxyUrl.startsWith("https://");
    const caRaw = process.env.SHOPIFY_EGRESS_PROXY_CA;

    // For a TLS proxy with a self-signed cert, pin it so the connection to the
    // proxy is authenticated (not just encrypted). `proxyTls` governs the TLS
    // handshake with the proxy; the end-to-end TLS to Shopify (`requestTls`)
    // keeps using the system CA store, unchanged.
    const proxyTls =
      isTls && caRaw
        ? { ca: caRaw.replace(/\\n/g, "\n"), rejectUnauthorized: true }
        : undefined;

    setGlobalDispatcher(new ProxyAgent({ uri: proxyUrl, proxyTls }));
    // Avoid logging the URL — it may embed proxy credentials.
    console.log(
      `[TieredPricing] Egress proxy enabled for outbound fetch (${
        isTls ? "TLS" : "plaintext"
      } proxy connection${isTls && !caRaw ? ", system CAs" : ""}).`,
    );
    if (isTls && !caRaw) {
      console.warn(
        "[TieredPricing] https proxy set without SHOPIFY_EGRESS_PROXY_CA — " +
          "relying on system CAs; a self-signed proxy cert will fail to verify.",
      );
    }
  } catch (err) {
    // Fail loud but don't crash the server: an unreachable/misconfigured proxy
    // should surface in logs, not take the whole app down on boot.
    console.error(
      "[TieredPricing] Failed to install egress proxy from SHOPIFY_EGRESS_PROXY_URL:",
      err,
    );
  }
}
