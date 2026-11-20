import { fetch as undiciFetch, ProxyAgent, setGlobalDispatcher } from "undici";

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
 * external static-IP forward proxy (self-hosted squid on Fly.io) and allowlist
 * that proxy's static egress IP.
 *
 * Why we patch globalThis.fetch (not just setGlobalDispatcher):
 * `@shopify/shopify-api`'s node adapter wires its HTTP client to the *built-in*
 * global fetch (`setAbstractFetchFunc(globalThis.fetch)`). Node's built-in fetch
 * keeps its OWN undici global dispatcher, SEPARATE from the `undici` npm
 * package's — so `setGlobalDispatcher()` from the package does NOT route it, and
 * Admin API calls leak out via Vercel's dynamic IPs. We instead replace
 * globalThis.fetch with undici's fetch bound to our ProxyAgent. This MUST run
 * before the Shopify node adapter imports (it captures globalThis.fetch at
 * import time) — hence this module is imported first in shopify.server.ts and
 * runs its work as an import side effect.
 *
 * Shopify Admin API traffic stays HTTPS end-to-end via CONNECT tunnelling, so
 * the proxy only ever sees ciphertext + the destination host. Use an `https://`
 * proxy URL to also encrypt the Vercel→proxy hop (the basic-auth header); the
 * proxy terminates TLS (stunnel) and we pin its self-signed CA via
 * SHOPIFY_EGRESS_PROXY_CA. DB traffic (Prisma → Neon over TCP) is not `fetch`,
 * so it is never proxied.
 *
 * Off by default: if SHOPIFY_EGRESS_PROXY_URL is unset, nothing changes.
 *
 * Env:
 *   SHOPIFY_EGRESS_PROXY_URL  http://user:pass@host:3128 (plaintext proxy) or
 *                             https://user:pass@host:3128 (TLS proxy — preferred)
 *   SHOPIFY_EGRESS_PROXY_CA   PEM of the proxy's TLS cert to trust (required for
 *                             an https:// proxy with a self-signed cert). Literal
 *                             "\n" are normalised to real newlines.
 */
let installed = false;

export function installEgressProxy(): void {
  if (installed) return;
  const proxyUrl = process.env.SHOPIFY_EGRESS_PROXY_URL;
  if (!proxyUrl) return;

  try {
    const isTls = proxyUrl.startsWith("https://");
    const caRaw = process.env.SHOPIFY_EGRESS_PROXY_CA;

    // proxyTls governs the TLS handshake WITH the proxy; pin the self-signed CA
    // so the connection is authenticated, not just encrypted. The end-to-end TLS
    // to Shopify keeps using the system CA store (unchanged).
    const proxyTls =
      isTls && caRaw
        ? { ca: caRaw.replace(/\\n/g, "\n"), rejectUnauthorized: true }
        : undefined;

    const agent = new ProxyAgent({ uri: proxyUrl, proxyTls });
    setGlobalDispatcher(agent);

    // Route the built-in global fetch (used by the Shopify SDK) through the
    // proxy by replacing it with undici's fetch bound to our ProxyAgent.
    const proxied = ((input: unknown, init?: Record<string, unknown>) =>
      undiciFetch(input as never, {
        ...(init ?? {}),
        dispatcher: agent,
      } as never)) as unknown as typeof globalThis.fetch;
    globalThis.fetch = proxied;

    installed = true;
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
    // Fail loud but don't crash the server: a misconfigured proxy should surface
    // in logs, not take the whole app down on boot.
    console.error(
      "[TieredPricing] Failed to install egress proxy from SHOPIFY_EGRESS_PROXY_URL:",
      err,
    );
  }
}

// Run as an import side effect so the globalThis.fetch patch lands BEFORE the
// Shopify node adapter captures globalThis.fetch (see note above).
installEgressProxy();
